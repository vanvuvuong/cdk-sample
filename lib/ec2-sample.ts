import { PARAMS } from "./params";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as aas from "aws-cdk-lib/aws-autoscaling";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cfo from "aws-cdk-lib/aws-cloudfront-origins";
import * as lbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
export class Ec2Sample extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        /*
        Create VPC - start
        */
        // Create new VPC with 2 subnets
        const vpc = new ec2.Vpc(this, PARAMS.vpc.id, {
            vpcName: PARAMS.vpc.name,
            availabilityZones: PARAMS.vpc.az,
            natGateways: PARAMS.vpc.natGateways,
            subnetConfiguration: [
                {
                    name: PARAMS.vpc.webSubnetName,
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
                {
                    name: PARAMS.vpc.rdsSubnetName,
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
                {
                    name: PARAMS.vpc.pubTestNetName,
                    subnetType: ec2.SubnetType.PUBLIC,
                    mapPublicIpOnLaunch: true,
                    cidrMask: 24
                }
            ]
        });
        vpc.addGatewayEndpoint('S3Endpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.webSubnetName })]
        });
        /* end */

        /*
        Create Security Groups - start
        */
        // Security Group for ALB
        const albSecurityGroup = new ec2.SecurityGroup(this, PARAMS.alb.sgId, {
            vpc,
            securityGroupName: PARAMS.alb.sgName,
            description: "Open to the internet."
        });
        albSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(80), "Allow all HTTP traffic to load balancer");

        // Security Group for Auto Scaling Group
        const instanceSecurityGroup = new ec2.SecurityGroup(this, PARAMS.asg.sgId, {
            vpc,
            securityGroupName: PARAMS.asg.sgName,
            description: "SG for autoscaling group"
        });
        instanceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(80), "Allow HTTP all connections from Load Balancer");
        instanceSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(22), "Allow inbounds SSH connections from the same instances within VPC");

        // Security Group for RDS
        const rdsSecurityGroup = new ec2.SecurityGroup(this, PARAMS.rds.sgId, {
            vpc,
            securityGroupName: PARAMS.rds.sgName,
            description: "SG for RDS"
        });
        rdsSecurityGroup.addIngressRule(instanceSecurityGroup, ec2.Port.tcp(3306));
        /* end */

        /*
        Create Load Balancer - start
        */
        const webALB = new lbv2.ApplicationLoadBalancer(this, PARAMS.alb.id, {
            vpc,
            loadBalancerName: PARAMS.alb.name,
            securityGroup: albSecurityGroup,
            internetFacing: true,
            idleTimeout: cdk.Duration.seconds(180),
            vpcSubnets: vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.webSubnetName })
        });

        // add listener to alb
        const listener80 = webALB.addListener('Listener', {
            port: 80,
            open: true
        });
        listener80.addAction('redirect', {
            action: lbv2.ListenerAction.redirect({
                port: "80",
                protocol: lbv2.Protocol.HTTP
            })
        });
        /* end */

        /*
        Create Auto Scaling Groups - start
        */
        const userData = ec2.UserData.forLinux();
        userData.addCommands(
            "sudo amazon-linux-extras install nginx1 -y",
            "sudo amazon-linux-extras enable php8.0",
            "sudo systemctl enable nginx",
            "sudo systemctl start nginx",
            "sudo systemctl start php-fpm"
        );
        const ami = new ec2.AmazonLinuxImage({
            generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
            cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        });
        const template = new ec2.LaunchTemplate(this, PARAMS.asg.ltId, {
            userData,
            machineImage: ami,
            keyName: PARAMS.ec2KeyName,
            launchTemplateName: PARAMS.asg.ltName,
            securityGroup: instanceSecurityGroup,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
        });
        const autoscaling = new aas.AutoScalingGroup(this, PARAMS.asg.id, {
            vpc,
            autoScalingGroupName: PARAMS.asg.name,
            launchTemplate: template,
            minCapacity: 2,
            maxCapacity: 3,
        });
        const targetGroup = new lbv2.ApplicationTargetGroup(this, PARAMS.asg.tgId, {
            vpc,
            targetGroupName: PARAMS.asg.tgName,
            port: 80,
            targets: [autoscaling],
            healthCheck: {
                path: "/",
                unhealthyThresholdCount: 3,
                healthyThresholdCount: 5,
                interval: cdk.Duration.seconds(15),
                protocol: lbv2.Protocol.HTTP,
                healthyHttpCodes: "200"
            },
        });
        // Adding lister's target groups
        listener80.addTargetGroups('addTargetGroups', {
            targetGroups: [targetGroup]
        });
        /* end */

        /*
        Create RDS - start
        */
        const cluster = new rds.DatabaseInstance(this, PARAMS.rds.id, {
            vpc,
            port: 3306,
            allocatedStorage: 60,
            publiclyAccessible: false,
            networkType: rds.NetworkType.IPV4,
            multiAz: true,
            credentials: rds.Credentials.fromGeneratedSecret('admin'), // create secret key in AWS Secret Manager
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
            vpcSubnets: {
                subnetGroupName: PARAMS.vpc.rdsSubnetName
            },
            engine: rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_8_0_28
            }),
            securityGroups: [rdsSecurityGroup]
        });
        /* end */

        const lbOrigin = new cfo.LoadBalancerV2Origin(webALB, {
            connectionAttempts: 3,
            connectionTimeout: cdk.Duration.seconds(10),
            readTimeout: cdk.Duration.seconds(45),
            keepaliveTimeout: cdk.Duration.seconds(45),
            protocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
            httpPort: 80,
        });

        const cfOriginAccessIdentity = new cf.OriginAccessIdentity(this, 'OAI', {
            comment: "only from cloudfront to s3 - static with ecs",
        });

        const bucket = new s3.Bucket(this, PARAMS.cf.bucketId, {
            publicReadAccess: false,
            bucketName: PARAMS.cf.bucketName,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: '404.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            accessControl: s3.BucketAccessControl.PRIVATE,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
        });
        bucket.grantRead(cfOriginAccessIdentity);

        const sampleHtmlFile = new s3deploy.BucketDeployment(this, PARAMS.cf.fileId, {
            destinationBucket: bucket,
            sources: [s3deploy.Source.asset('./public')],
        });

        const cloudfront = new cf.CloudFrontWebDistribution(this, PARAMS.sw.id, {
            originConfigs: [
                {
                    s3OriginSource: {
                        originPath: "",
                        s3BucketSource: bucket,
                        originAccessIdentity: cfOriginAccessIdentity,
                    },
                    behaviors: [{
                        isDefaultBehavior: true,
                        viewerProtocolPolicy: cf.ViewerProtocolPolicy.ALLOW_ALL,
                    }]
                }, {
                    customOriginSource: {
                        domainName: webALB.loadBalancerDnsName,
                        originProtocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
                        httpPort: 80,
                    },
                    behaviors: [{
                        pathPattern: "/ec2*",
                        allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                        viewerProtocolPolicy: cf.ViewerProtocolPolicy.ALLOW_ALL
                    }]
                }
            ],
            errorConfigurations: [{
                errorCode: 404,
                responsePagePath: "404.html"
            }],
            priceClass: cf.PriceClass.PRICE_CLASS_ALL,
            httpVersion: cf.HttpVersion.HTTP2_AND_3
        });
    }
}