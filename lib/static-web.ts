import { PARAMS } from "./params";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cf from "aws-cdk-lib/aws-cloudfront";

export class StaticWeb extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const cfOriginAccessIdentity = new cf.OriginAccessIdentity(this, 'OAI', {
            comment: "only from cloudfront to s3 - static only",
        });

        const bucket = new s3.Bucket(this, PARAMS.sw.bucketId, {
            publicReadAccess: false,
            bucketName: PARAMS.sw.bucketName,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: '404.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
        });
        bucket.grantRead(cfOriginAccessIdentity);

        const sampleHtmlFile = new s3deploy.BucketDeployment(this, PARAMS.sw.fileId, {
            destinationBucket: bucket,
            sources: [s3deploy.Source.asset('./public')]
        });

        const cloudfront = new cf.CloudFrontWebDistribution(this, PARAMS.sw.id, {
            originConfigs: [{
                s3OriginSource: {
                    originPath: "",
                    s3BucketSource: bucket,
                    originAccessIdentity: cfOriginAccessIdentity,
                },
                behaviors: [{
                    isDefaultBehavior: true,
                    viewerProtocolPolicy: cf.ViewerProtocolPolicy.ALLOW_ALL,
                }],
            }],
            priceClass: cf.PriceClass.PRICE_CLASS_ALL,
            httpVersion: cf.HttpVersion.HTTP2_AND_3
        });
    }
}