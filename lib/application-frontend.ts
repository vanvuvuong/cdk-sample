import * as cdk from 'aws-cdk-lib';
import { PARAMS } from "./params";
import { Construct } from 'constructs';
import { BaseApplication } from './application-base';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cf from "aws-cdk-lib/aws-cloudfront";

export class FrontEnd extends BaseApplication {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create the ACM certificate

        // Create route53 hosted zone

        // Create s3 frontend bucket
        const cfOriginAccessIdentity = new cf.OriginAccessIdentity(this, 'OAI', {
            comment: "only from cloudfront to s3 - static with ecs",
        });

        const bucket = new s3.Bucket(this, PARAMS.cf.bucketId, {
            publicReadAccess: false,
            bucketName: PARAMS.cf.bucketName,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: '404.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            accessControl: s3.BucketAccessControl.PRIVATE,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
        });
        bucket.grantRead(cfOriginAccessIdentity);

        const sampleHtmlFile = new s3deploy.BucketDeployment(this, PARAMS.cf.fileId, {
            destinationBucket: bucket,
            sources: [s3deploy.Source.asset('./public')],
        });

        // Create cloudfront distribution
        const cloudfront = new cf.CloudFrontWebDistribution(this, PARAMS.sw.id, {
            originConfigs: [
                {
                    s3OriginSource: {
                        originPath: "",
                        s3BucketSource: bucket,
                        originAccessIdentity: cfOriginAccessIdentity,
                    },
                    behaviors: [{
                        isDefaultBehavior: true,
                        viewerProtocolPolicy: cf.ViewerProtocolPolicy.ALLOW_ALL,
                    }]
                },
                // {
                //     customOriginSource: {
                //         domainName: this.webAlbService.loadBalancer.loadBalancerDnsName,
                //         originProtocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
                //         httpPort: 80,
                //     },
                //     behaviors: [{
                //         pathPattern: "/ecs*",
                //         allowedMethods: cf.CloudFrontAllowedMethods.ALL,
                //         viewerProtocolPolicy: cf.ViewerProtocolPolicy.ALLOW_ALL
                //     }]
                // }
            ],
            errorConfigurations: [{
                errorCode: 404,
                responsePagePath: "404.html"
            }],
            priceClass: cf.PriceClass.PRICE_CLASS_ALL,
            httpVersion: cf.HttpVersion.HTTP2_AND_3
        });

    }
}