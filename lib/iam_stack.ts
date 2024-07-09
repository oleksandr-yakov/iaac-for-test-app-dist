import * as cdk from 'aws-cdk-lib';
import {Repository} from "aws-cdk-lib/aws-ecr";
import {
  AnyPrincipal,
  Effect,
  Policy,
  PolicyDocument,
  PolicyStatement,
  Role,
  OpenIdConnectProvider, WebIdentityPrincipal, User, CfnAccessKey
} from 'aws-cdk-lib/aws-iam';
import {EcrStack} from "./ecr_stack";
import {StringParameter} from 'aws-cdk-lib/aws-ssm';
import {Construct} from "constructs";

import {ECR_ARN_SSM_PARAM_NAMES} from "./const";

interface StackParams {
    env: object
}

export class IamStack extends cdk.Stack {
  _frontendRepositoryArn: string
  _backendRepositoryArn: string
  constructor(app: cdk.App, stackId: string, params: StackParams) {
    super(app, stackId, {env: params.env});
    this._frontendRepositoryArn = this.retrieveRepositoryArnFromSsm(ECR_ARN_SSM_PARAM_NAMES.frontendRepositoryArn)
    this._backendRepositoryArn = this.retrieveRepositoryArnFromSsm(ECR_ARN_SSM_PARAM_NAMES.backendRepositoryArn)

    const allRepositoryArns = [
      this._frontendRepositoryArn,
      this._backendRepositoryArn
    ]
    // pull images user
    let pullImagesUser = new User(this, 'oidc-pull-images-user', {
      userName: 'oidc-pull-images-user'
    });

    const accessKey = new CfnAccessKey(this, 'AccessKey', {
      userName: pullImagesUser.userName
    });

    new cdk.CfnOutput(this, 'AccessKeyId', {
      value: accessKey.ref,
      description: 'Pull Images User\'s Access Key ID'
    });

    new cdk.CfnOutput(this, 'SecretAccessKey', {
      value: accessKey.attrSecretAccessKey,
      description: 'Pull Images User\'s Secret Access Key'
    });


    //openid connect provider
    let oidcProviderArm = 'arn:aws:iam::905418051827:oidc-provider/token.actions.githubusercontent.com'
    let githubOpenIdConnectProvider = OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'oidc-provider', oidcProviderArm);

    const repositories = [
      {
        id: 'app-frontend',
        name: 'oleksandr-yakov/frontend-for-test-app-dist',
        targetImageRepositoryArns: [
          this._frontendRepositoryArn,
        ]
      }, {
        id: 'app-backend',
        name: 'oleksandr-yakov/backend-for-test-app-dist',
        targetImageRepositoryArns: [
          this._backendRepositoryArn,
        ],
      }
    ]

    //GitHub action roles for push to ecr
    repositories.forEach(({id, name, targetImageRepositoryArns}) => {
      // push role
      new Role(this, `oidc-${id}-github-push-role`, {
        roleName: `${id}-github-push-role`,
        assumedBy: new WebIdentityPrincipal(
          githubOpenIdConnectProvider.openIdConnectProviderArn,
          {
            'StringEquals': {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
            },
            'StringLike': {
              'token.actions.githubusercontent.com:sub': `repo:${name}:*`
            }
          }),
        inlinePolicies: {
          'push-policy': new PolicyDocument({
            statements: [
              new PolicyStatement({ //allow to get ecr auth token
                effect: Effect.ALLOW,
                actions: ["ecr:GetAuthorizationToken"],
                resources: ["*"]
              }),
              new PolicyStatement({ //allow to push image to ecr
                  effect: Effect.ALLOW,
                  actions: [
                    "ecr:BatchGetImage",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:CompleteLayerUpload",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:InitiateLayerUpload",
                    "ecr:PutImage",
                    "ecr:UploadLayerPart"
                  ],
                  resources: targetImageRepositoryArns
              }),
            ]
          }),
        }
      });
    });

    // pull role
    new Role(this, `oidc-github-pull-role`, {
      roleName: `oidc-github-pull-role`,
      assumedBy: pullImagesUser,
      inlinePolicies: {
        'pull-policy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["ecr:GetAuthorizationToken"],
              resources: ["*"]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
              ],
              resources: allRepositoryArns
            }),
          ],
        }),
      }
    });
  }

  private retrieveRepositoryArnFromSsm(paramName: string): string {
    const repositoryArn = StringParameter.valueForStringParameter(this, paramName);
    let repositoryName = repositoryArn.split('/').slice(-1)[0];
    const repository = Repository.fromRepositoryAttributes(this, paramName, {
        repositoryArn: repositoryArn,
        repositoryName: repositoryName
    });
    if (repository) {
        return repository.repositoryArn;
    } else {
        throw new Error(`Repository ${paramName} not found`);
    }
  }
   
}
