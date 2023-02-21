import { PARAMS } from './params';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';


export class BaseApplication extends cdk.Stack {
    vpc: ec2.Vpc
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Prepare IAM, cloudtrail, cloudwatch

        // Create vpc net & subnet
        const vpc = new ec2.Vpc(this, PARAMS.vpc.id, {
            vpcName: PARAMS.vpc.name,
            availabilityZones: PARAMS.vpc.az,
            natGateways: PARAMS.vpc.natGateways,
            subnetConfiguration: [
                {
                    name: PARAMS.vpc.serverlessSubnet1a,
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
                {
                    name: PARAMS.vpc.serverlessSubnet1c,
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    mapPublicIpOnLaunch: true,
                    cidrMask: 24
                }
            ]
        });
        this.vpc = vpc;

        // Create cognito

    }
}