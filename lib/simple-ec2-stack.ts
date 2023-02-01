import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";



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
                    name: "web-private-net",
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
                {
                    name: "rds-private-net",
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
            ]
        });

        // Create Security Group to SSH to EC2 instances in private subnet
        const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
            vpc,
            securityGroupName: "WebServer",
            description: "Allow SSH to webserver instances by instances in the same subnet."
        });
        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "Allow SSH");

        // // Use latest Amazon Linux Image - CPU type x84_64
        // const ami = new ec2.AmazonLinuxImage({
        //     generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        //     cpuType: ec2.AmazonLinuxCpuType.X86_64,
        // });

        // // Create the instance using SG, AMI in vpc
        // const ec2Instance = new ec2.Instance(this, 'Instance', {
        //     vpc,
        //     securityGroup,
        //     machineImage: ami,
        //     instanceName: "WebServer",
        //     instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        // });
    }
}