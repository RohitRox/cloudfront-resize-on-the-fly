import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as iam from 'aws-cdk-lib/aws-iam'
import { CfnOutput, Duration, Stack, App, StackProps } from 'aws-cdk-lib'
import * as path from 'path'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins'

import Config from '../config.json'

export class AppStack extends Stack {
  constructor(parent: App, name: string, props: StackProps) {
    super(parent, name, props)

    const assetBucket = new s3.Bucket(
      this,
      `${Config.stack.prefix}-storage-bucket`,
      {
        bucketName: Config.bucket.name,
        publicReadAccess: false,
      }
    )

    new CfnOutput(this, `${Config.stack.prefix}-storage-bucket}-name`, {
      value: assetBucket.bucketName,
    })

    const originResponseFunc = new lambda.Function(
      this,
      `${Config.stack.prefix}-cdn-origin-resp-handler`,
      {
        runtime: lambda.Runtime.NODEJS_16_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda/origin-response-handler')
        ),
        role: new iam.Role(this, 'originResponseFuncRole', {
          assumedBy: new iam.CompositePrincipal(
            new iam.ServicePrincipal('lambda.amazonaws.com')
          ),
          managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambdaExecute'),
          ],
        }),
        timeout: Duration.seconds(30),
      }
    )

    assetBucket.grantRead(originResponseFunc)
    assetBucket.grantPut(originResponseFunc)

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'OAI'
    )
    assetBucket.grantRead(originAccessIdentity)

    const distribution = new cloudfront.Distribution(
      this,
      `${Config.stack.prefix}-cfn-cdn`,
      {
        defaultRootObject: 'index.html',
        defaultBehavior: {
          origin: new cloudfrontOrigins.S3Origin(assetBucket, {
            originAccessIdentity,
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          edgeLambdas: [
            {
              functionVersion: originResponseFunc.currentVersion,
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_RESPONSE,
            },
          ],
        },
      }
    )

    new CfnOutput(this, `${Config.stack.prefix}-cdn-dist-id`, {
      value: distribution.distributionId,
    })

    new CfnOutput(this, `${Config.stack.prefix}-cdn-dist-domain`, {
      value: distribution.distributionDomainName,
    })
  }
}
