import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as aas from "aws-cdk-lib/aws-autoscaling";
import * as sm from "aws-cdk-lib/aws-secretsmanager";
import * as lbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

const PARAMS = {
    vpc: {
        id: "VPC", name: "Kasumi-Sample", az: ["ap-northeast-1a", "ap-northeast-1c"],
        natGateways: 1, webSubnetName: "web-private-net", rdsSubnetName: "rds-private-net",
        testNetName: "publicTestNet", privateNetRTId: "PrivateRT"
    },
    alb: { id: "ApplicationLoadBalancer", name: "WebServer-ALB", sgName: "alb-sg", sgId: "ALB-SecurityGroup" },
    asg: {
        id: "AutoScalingGroup", name: "kasumi-webserver", sgId: "ASG-SecurityGroup", sgName: "auto-scale-sg",
        ltId: "LaunchTemplate", ltName: "webserver", tgId: "TargetGroup", tgName: "Kasumi-WebServer-TG"
    },
    rds: { id: "MySQL-Database", name: "kasumi-sample", sgId: "RdsSG", sgName: 'rds-sg' },
    sm: { id: "SecretManager" }
}
export class KasumiSampleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        /*
        Create VPC
            start
        */
        // Create new VPC with 2 subnets
        const vpc = new ec2.Vpc(this, PARAMS.vpc.id, {
            vpcName: PARAMS.vpc.name,
            availabilityZones: PARAMS.vpc.az,
            natGateways: PARAMS.vpc.natGateways,
            subnetConfiguration: [
                {
                    name: PARAMS.vpc.webSubnetName,
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
                {
                    name: PARAMS.vpc.rdsSubnetName,
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
                {
                    name: PARAMS.vpc.testNetName,
                    subnetType: ec2.SubnetType.PUBLIC,
                    mapPublicIpOnLaunch: true,
                    cidrMask: 24
                }
            ]
        });
        /* end */

        /*
        Create Security Groups
            start
        */
        // Security Group for ALB
        const albSecurityGroup = new ec2.SecurityGroup(this, PARAMS.alb.sgId, {
            vpc,
            securityGroupName: PARAMS.alb.sgName,
            description: "Open to the internet."
        });
        albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow all HTTP traffic to load balancer");

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
        Create Load Balancer
            start
        */
        const webALB = new lbv2.ApplicationLoadBalancer(this, PARAMS.alb.id, {
            vpc,
            loadBalancerName: PARAMS.alb.name,
            securityGroup: albSecurityGroup,
            internetFacing: false,
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
        Create Auto Scaling Groups
            start
        */
        const userData = ec2.UserData.forLinux();
        userData.addCommands(
            "sudo yum update",
            "sudo yum install mysql telnet -y",
            "sudo amazon-linux-extras install nginx1",
            "sudo systemctl enable nginx",
            "sudo systemctl start nginx",
        );
        const ami = new ec2.AmazonLinuxImage({
            generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
            cpuType: ec2.AmazonLinuxCpuType.X86_64,
        });
        const template = new ec2.LaunchTemplate(this, PARAMS.asg.ltId, {
            userData,
            machineImage: ami,
            keyName: 'sample',
            launchTemplateName: PARAMS.asg.ltName,
            securityGroup: instanceSecurityGroup,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
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
            }
        });
        // Adding lister's target groups
        listener80.addTargetGroups('addTargetGroups', {
            targetGroups: [targetGroup]
        });
        /* end */

        /*
        Create RDS
            start
        */
        const cluster = new rds.DatabaseInstance(this, PARAMS.rds.id, {
            vpc,
            port: 3306,
            allocatedStorage: 60,
            publiclyAccessible: false,
            networkType: rds.NetworkType.IPV4,
            availabilityZone: PARAMS.vpc.az[0],
            credentials: rds.Credentials.fromGeneratedSecret('admin'), // create secret key in AWS Secret Manager
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            vpcSubnets: {
                subnetGroupName: PARAMS.vpc.webSubnetName
            },
            engine: rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_5_7
            }),
            securityGroups: [rdsSecurityGroup]
        });
        /* end */
    }
}