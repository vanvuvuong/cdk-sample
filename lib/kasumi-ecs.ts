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
        // vpc.addInterfaceEndpoint('Sample', {
        //     service: ec2.InterfaceVpcEndpointAwsService.ECS
        // });
        // vpc.addInterfaceEndpoint('Sample', {
        //     service: ec2.InterfaceVpcEndpointAwsService.ECS_AGENT
        // });
        // vpc.addInterfaceEndpoint('Sample', {
        //     service: ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY
        // });

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
        // asgSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic(), "Allow inbounds SSH connections from the same instances within VPC");
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
            containerName: "nginx",
            memoryLimitMiB: 512,
            essential: true,
            entryPoint: ["sleep", "infinity"],
            healthCheck: {
                command: ["CMD-SHELL", "curl -f http://localhost/ || exit 1"],
                timeout: cdk.Duration.seconds(30)
            }
        });
        webContainer.addPortMappings({
            hostPort: 80,
            containerPort: 80,
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
    }
}