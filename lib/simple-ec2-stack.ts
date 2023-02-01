import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as aas from "aws-cdk-lib/aws-autoscaling";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";

export class Ec2Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create new VPC with 2 subnets
        const vpc = new ec2.Vpc(this, 'VPC', {
            vpcName: "Kasumi-Sample",
            availabilityZones: ["ap-northeast-1a", "ap-northeast-1c"],
            natGateways: 0,
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
        const albSecurityGroup = new ec2.SecurityGroup(this, 'ALB-SecurityGroup', {
            vpc,
            securityGroupName: "alb-sg",
            description: "Open to the internet."
        });

        const webALB = new lbv2.ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
            vpc,
            securityGroup: albSecurityGroup,
            internetFacing: false,
            loadBalancerName: 'WebServer-ALB',
            idleTimeout: Duration.seconds(180),
        });

        // add listener to alb
        const listener80 = webALB.addListener('Listener', {
            port: 80,
            open: true
        });

        /* Create Auto Scaling Groups */
        // Security Group for Auto Scaling Group
        const instanceSecurityGroup = new ec2.SecurityGroup(this, 'ASG-SecurityGroup', {
            vpc,
            securityGroupName: "auto-scale-sg",
            description: "SG for autoscaling group"
        });
        // allow inbound connection from ALB
        instanceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(80));

        // Launch Template
        const template = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
            machineImage: ami,
            launchTemplateName: 'webserver',
            securityGroup: instanceSecurityGroup,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO)
        });
        const autoscaling = new aas.AutoScalingGroup(this, 'AutoScalingGroup', {
            vpc,
            autoScalingGroupName: 'kasumi-webserver',
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
        const targetGroup = new lbv2.ApplicationTargetGroup(this, 'TargetGroup', {
            vpc,
            targetGroupName: 'Kasumi-WebServer-TG',
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