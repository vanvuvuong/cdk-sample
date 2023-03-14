import { PARAMS } from './params';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as appsync from 'aws-cdk-lib/aws-appsync';


export class TestComponent extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        // Create vpc net & subnet
        const vpc = new ec2.Vpc(this, PARAMS.vpc.id, {
            vpcName: PARAMS.vpc.name,
            availabilityZones: PARAMS.vpc.az,
            natGateways: PARAMS.vpc.natGateways,
            subnetConfiguration: [
                {
                    name: PARAMS.vpc.serverlessSubnet1a,
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: PARAMS.vpc.serverlessSubnet1c,
                    subnetType: ec2.SubnetType.PUBLIC,
                    mapPublicIpOnLaunch: true,
                    cidrMask: 24
                }
            ]
        });


        // Create appsync
        const appSync = new appsync.GraphqlApi(this, "AppSyncTest", {
            name: "AppSyncComponent",
            schema: appsync.SchemaFile.fromAsset("./src/graphql/schema.json")
        });

        // Security Group for RDS
        const rdsSecurityGroup = new ec2.SecurityGroup(this, PARAMS.rds.sgId, {
            vpc,
            securityGroupName: PARAMS.rds.sgName,
            description: "SG for RDS"
        });

        // Create lambda
        const lambdaFunction = new lambda.Function(this, PARAMS.lambda.id, {
            vpc,
            securityGroups: [rdsSecurityGroup],
            vpcSubnets: vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.serverlessSubnet1a }),
            memorySize: 512,
            runtime: lambda.Runtime.PYTHON_3_9,
            allowAllOutbound: true,
            allowPublicSubnet: true,
            functionName: "python-3-8",
            code: lambda.Code.fromAsset('./lambda_function'),
            handler: "",
        });

    }
}