import { PARAMS } from "./params";
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
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
                    name: PARAMS.vpc.testNetName,
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

        let cluster = new ecs.Cluster(this, PARAMS.ecs.clusterId, {
            vpc,
            containerInsights: true,
        });
        cluster.addCapacity(PARAMS.ecs.ccId, {
            minCapacity: 2,
            desiredCapacity: 2,
            keyName: PARAMS.ec2KeyName,
            instanceType: new ec2.InstanceType("t2.micro"),
            machineImage: new ec2.AmazonLinuxImage({
                cpuType: ec2.AmazonLinuxCpuType.X86_64,
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            vpcSubnets: vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.testNetName })
        })
        let taskDefinition = new ecs.Ec2TaskDefinition(this, PARAMS.ecs.tdId, {
            family: "WebService",
        });
        let webContainer = taskDefinition.addContainer(PARAMS.ecs.containerId, {
            image: ecs.ContainerImage.fromRegistry(PARAMS.ecs.albId),
            containerName: "nginx",
            memoryLimitMiB: 512,
            command: ["sleep", "infinity"],
            cpu: 0.5,
        });
        webContainer.addPortMappings({
            hostPort: 80,
            containerPort: 80,
            protocol: ecs.Protocol.TCP
        })

        new ecsp.ApplicationLoadBalancedEc2Service(this, PARAMS.ecs.albId, {
            cluster,
            taskDefinition,
            cpu: 0.5,
            desiredCount: 2,
            publicLoadBalancer: true,
            serviceName: "nginx-server",
        });
    }
}