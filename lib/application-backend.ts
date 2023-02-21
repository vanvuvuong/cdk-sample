import { PARAMS } from './params';
import { BaseApplication } from './application-base';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds'
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as appsync from 'aws-cdk-lib/aws-appsync';


export class BackEnd extends BaseApplication {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);


        // Create appsync
        const appSync = new appsync.GraphqlApi(this, PARAMS.appSync.id, {
            name: PARAMS.appSync.name,
            schema: appsync.SchemaFile.fromAsset("./src/schema.json")
        });

        // Security Group for RDS
        const rdsSecurityGroup = new ec2.SecurityGroup(this, PARAMS.rds.sgId, {
            vpc: this.vpc,
            securityGroupName: PARAMS.rds.sgName,
            description: "SG for RDS"
        });
        // rdsSecurityGroup.addIngressRule(instanceSecurityGroup, ec2.Port.tcp(3306));

        // Create lambda
        const lambdaFunction = new lambda.Function(this, PARAMS.lambda.id, {
            vpc: this.vpc,
            securityGroups: [rdsSecurityGroup],
            vpcSubnets: this.vpc.selectSubnets({ subnetGroupName: PARAMS.vpc.serverlessSubnet1a }),
            memorySize: 512,
            runtime: lambda.Runtime.NODEJS_18_X,
            allowAllOutbound: true,
            functionName: "node-server",
            code: lambda.Code.fromAsset('./lib/function.js'),
            handler: "",
        });


        /*
        Create RDS
            start
        */
        const rdsCluster = new rds.DatabaseInstance(this, PARAMS.rds.id, {
            vpc: this.vpc,
            port: 3306,
            allocatedStorage: 60,
            publiclyAccessible: false,
            deleteAutomatedBackups: true,
            networkType: rds.NetworkType.IPV4,
            availabilityZone: PARAMS.vpc.az[0],
            credentials: rds.Credentials.fromGeneratedSecret('admin'), // create secret key in AWS Secret Manager
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
            vpcSubnets: {
                subnetGroupName: PARAMS.vpc.rdsSubnetName
            },
            engine: rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_8_0_28
            }),
            securityGroups: [rdsSecurityGroup],
            backupRetention: cdk.Duration.days(0),
        });
        /* end */

        // Create S3
        const bucket = new s3.Bucket(this, PARAMS.sw.bucketId, {
            publicReadAccess: false,
            bucketName: PARAMS.sw.bucketName,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: '404.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
        });
    }
}