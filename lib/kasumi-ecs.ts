import { PARAMS } from "./params";
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as aas from "aws-cdk-lib/aws-autoscaling";
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
                    name: PARAMS.vpc.webSubnetName,
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

        const cluster = new ecs.Cluster(this, PARAMS.ecs.clusterId, {
            vpc,
            containerInsights: true,
        });

        // Security Group for Auto Scaling Group
        const asgSecurityGroup = new ec2.SecurityGroup(this, PARAMS.asg.sgId, {
            vpc,
            securityGroupName: PARAMS.asg.sgName,
            description: "SG for autoscaling group"
        });
        asgSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), "Allow inbounds SSH connections from the same instances within VPC");
        const autoScalingGroup = cluster.addCapacity('ContainerCapacity', {
            minCapacity: 2,
            desiredCapacity: 2,
            keyName: PARAMS.ec2KeyName,
            allowAllOutbound: true,
            instanceType: new ec2.InstanceType("t2.micro"),
            machineImage: new ec2.AmazonLinuxImage({
                cpuType: ec2.AmazonLinuxCpuType.X86_64,
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            vpcSubnets: vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.pubTestNetName }),
        });
        autoScalingGroup.addSecurityGroup(asgSecurityGroup);

        let taskDefinition = new ecs.Ec2TaskDefinition(this, PARAMS.ecs.tdId, {
            family: "WebService",
        });
        let webContainer = taskDefinition.addContainer(PARAMS.ecs.containerId, {
            image: ecs.ContainerImage.fromRegistry(PARAMS.ecs.image),
            containerName: "nginx",
            memoryLimitMiB: 512,
            essential: true,
            command: ["sleep", "infinity"],
        });
        webContainer.addPortMappings({
            hostPort: 80,
            containerPort: 80,
            protocol: ecs.Protocol.TCP
        });
    }
}