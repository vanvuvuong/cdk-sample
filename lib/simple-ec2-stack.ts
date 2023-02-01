import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as aas from "aws-cdk-lib/aws-autoscaling";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";

const PARAMS = {
    vpc: { id: "VPC", name: "Kasumi-Sample", az: ["ap-northeast-1a", "ap-northeast-1c"], natGateways: 0 },
    alb: { id: "ApplicationLoadBalancer", name: "WebServer-ALB", sgName: "alb-sg", sgId: "ALB-SecurityGroup" },
    asg: { id: "AutoScalingGroup", name: "kasumi-webserver", sgId: "ASG-SecurityGroup", sgName: "auto-scale-sg", ltId: "LaunchTemplate", ltName: "webserver", tgId: "TargetGroup", tgName: "Kasumi-WebServer-TG" }
}
export class Ec2Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create new VPC with 2 subnets
        const vpc = new ec2.Vpc(this, PARAMS.vpc.id, {
            vpcName: PARAMS.vpc.name,
            availabilityZones: PARAMS.vpc.az,
            natGateways: PARAMS.vpc.natGateways,
            subnetConfiguration: [
                {
                    name: "web-private-net-",
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
                // {
                //     name: "rds-private-net-",
                //     subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                //     cidrMask: 24,
                // },
            ]
        });

        // Use latest Amazon Linux Image - CPU type x84_64
        const ami = new ec2.AmazonLinuxImage({
            generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
            cpuType: ec2.AmazonLinuxCpuType.X86_64,
        });

        /*
        Create Load Balancer
            Start
        */
        const albSecurityGroup = new ec2.SecurityGroup(this, PARAMS.alb.sgId, {
            vpc,
            securityGroupName: PARAMS.alb.sgName,
            description: "Open to the internet."
        });

        const webALB = new lbv2.ApplicationLoadBalancer(this, PARAMS.alb.id, {
            vpc,
            loadBalancerName: PARAMS.alb.name,
            securityGroup: albSecurityGroup,
            internetFacing: false,
            idleTimeout: Duration.seconds(180),
        });

        // add listener to alb
        const listener80 = webALB.addListener('Listener', {
            port: 80,
            open: true
        });

        /* Create Auto Scaling Groups */
        // Security Group for Auto Scaling Group
        const instanceSecurityGroup = new ec2.SecurityGroup(this, PARAMS.asg.sgId, {
            vpc,
            securityGroupName: PARAMS.asg.sgName,
            description: "SG for autoscaling group"
        });
        // allow inbound connection from ALB
        instanceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(80));

        // Launch Template
        const template = new ec2.LaunchTemplate(this, PARAMS.asg.ltId, {
            machineImage: ami,
            launchTemplateName: PARAMS.asg.ltId,
            securityGroup: instanceSecurityGroup,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO)
        });
        const autoscaling = new aas.AutoScalingGroup(this, PARAMS.asg.id, {
            vpc,
            autoScalingGroupName: PARAMS.asg.name,
            launchTemplate: template,
            minCapacity: 1,
            maxCapacity: 2,
        });

        listener80.addAction('route', {
            action: lbv2.ListenerAction.redirect({
                port: "80",
                protocol: lbv2.Protocol.HTTP
            })
        });

        // Target Group
        const targetGroup = new lbv2.ApplicationTargetGroup(this, PARAMS.asg.tgId, {
            vpc,
            targetGroupName: PARAMS.asg.tgName,
            port: 80,
            targets: [autoscaling],
            healthCheck: {
                path: "/",
                unhealthyThresholdCount: 3,
                healthyThresholdCount: 5,
                interval: Duration.seconds(15),
                protocol: lbv2.Protocol.HTTP,
                healthyHttpCodes: "200"
            }
        });
        listener80.addTargetGroups('addTargetGroups', {
            targetGroups: [targetGroup]
        });
        /* end */

    }
}