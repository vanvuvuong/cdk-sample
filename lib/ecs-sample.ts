import { PARAMS } from "./params";
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';

export class HelloEcs extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, PARAMS.vpc.id, {
            vpcName: PARAMS.vpc.name,
            availabilityZones: PARAMS.vpc.az,
            natGateways: PARAMS.vpc.natGateways,
            subnetConfiguration: [
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
                }]
        });

        // Security Group for Auto Scaling Group
        const asgSecurityGroup = new ec2.SecurityGroup(this, PARAMS.asg.sgId, {
            vpc,
            securityGroupName: PARAMS.asg.sgName,
            description: "SG for autoscaling group"
        });
        asgSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTraffic(), "Allow inbounds within VPC");

        // Security Group for RDS
        const rdsSecurityGroup = new ec2.SecurityGroup(this, PARAMS.rds.sgId, {
            vpc,
            securityGroupName: PARAMS.rds.sgName,
            description: "SG for RDS"
        });
        rdsSecurityGroup.addIngressRule(asgSecurityGroup, ec2.Port.tcp(3306));

        const cluster = new ecs.Cluster(this, PARAMS.ecs.clusterId, {
            vpc,
            containerInsights: false,
        });

        const autoScalingGroup = cluster.addCapacity('ContainerCapacity', {
            minCapacity: 2,
            desiredCapacity: 2,
            keyName: PARAMS.ec2KeyName,
            allowAllOutbound: true,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            vpcSubnets: vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.pubTestNetName }),
        });
        autoScalingGroup.addSecurityGroup(asgSecurityGroup);

        let taskDefinition = new ecs.Ec2TaskDefinition(this, PARAMS.ecs.tdId, {
            family: "WebService",
        });
        let webContainer = taskDefinition.addContainer(PARAMS.ecs.containerId, {
            image: ecs.ContainerImage.fromRegistry(PARAMS.ecs.image),
            containerName: "nginx-php",
            memoryLimitMiB: 128,
            essential: true,
        });
        webContainer.addPortMappings({
            hostPort: 80,
            containerPort: 8080,
            protocol: ecs.Protocol.TCP
        });

        const webAlb = new ecsp.ApplicationLoadBalancedEc2Service(this, PARAMS.ecs.albId, {
            cluster,
            taskDefinition,
            cpu: 0.5,
            memoryLimitMiB: 512,
            desiredCount: 2,
            publicLoadBalancer: true,
            serviceName: "nginx-server",
        });

        /*
        Create RDS
            start
        */
        const rdsCluster = new rds.DatabaseInstance(this, PARAMS.rds.id, {
            vpc,
            port: 3306,
            allocatedStorage: 60,
            publiclyAccessible: false,
            deleteAutomatedBackups: true,
            networkType: rds.NetworkType.IPV4,
            availabilityZone: PARAMS.vpc.az[0],
            credentials: rds.Credentials.fromGeneratedSecret('admin'), // create secret key in AWS Secret Manager
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            vpcSubnets: {
                subnetGroupName: PARAMS.vpc.rdsSubnetName
            },
            engine: rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_5_7
            }),
            securityGroups: [rdsSecurityGroup],
        });
        /* end */
    }
}