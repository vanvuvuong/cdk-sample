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
        });
        vpc.addGatewayEndpoint('S3Endpoint', {
            service: ec2.GatewayVpcEndpointAwsService.S3,
            subnets: [vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.pubTestNetName })]
        });

        const cluster = new ecs.Cluster(this, PARAMS.ecs.clusterId, {
            vpc,
            containerInsights: true,
        });

        // custom autoscaling group
        const ami = new ec2.AmazonLinuxImage({
            generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
            cpuType: ec2.AmazonLinuxCpuType.X86_64,
        });

        // Security Group for Auto Scaling Group
        const instanceSecurityGroup = new ec2.SecurityGroup(this, PARAMS.asg.sgId, {
            vpc,
            securityGroupName: PARAMS.asg.sgName,
            description: "SG for autoscaling group"
        });
        instanceSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(22), "Allow inbounds SSH connections from the same instances within VPC");

        const userData = ec2.UserData.forLinux();
        userData.addCommands(
            "sudo amazon-linux-extras disable docker",
            "sudo amazon-linux-extras install -y ecs"
        );
        const template = new ec2.LaunchTemplate(this, PARAMS.asg.ltId, {
            userData,
            machineImage: ami,
            role: new iam.Role(this, "LaunchTemplateIAM", {
                assumedBy: new iam.AnyPrincipal,
            }),
            keyName: PARAMS.ec2KeyName,
            launchTemplateName: PARAMS.asg.ltName,
            securityGroup: instanceSecurityGroup,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        });
        const autoScalingGroup = new aas.AutoScalingGroup(this, PARAMS.asg.id, {
            vpc,
            autoScalingGroupName: PARAMS.asg.name,
            launchTemplate: template,
            minCapacity: 2,
            maxCapacity: 3,
        });
        const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
            autoScalingGroup,
            canContainersAccessInstanceRole: true,
            enableManagedScaling: true,
            machineImageType: ecs.MachineImageType.AMAZON_LINUX_2
        });
        cluster.addAsgCapacityProvider(capacityProvider);

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