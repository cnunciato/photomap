# photomap

An example of using [Pulumi](https://pulumi.com/), [AWS](https://aws.amazon.com), [Mapbox](https://docs.mapbox.com/), and [Leaflet](https://leafletjs.com/) to build a serverless photomap.

![photomap](https://user-images.githubusercontent.com/274700/97764332-78111200-1acb-11eb-9cac-4f494c0a6bab.png)

## Prerequisites

* Install [Pulumi](https://pulumi.com/start) and [Node.js](https://nodejs.org) (the example uses Pulumi's [TypeScript SDK](https://www.pulumi.com/docs/intro/languages/javascript/)).
* An [AWS account](https://aws.amazon.com/free/) with credentials configured [in the usual way](https://www.pulumi.com/docs/intro/cloud-providers/aws/setup/).
* A [Mapbox](https://docs.mapbox.com/) public token, available at https://account.mapbox.com.

## Create your own!

Create your own Photomap project below using this one as a template. Have your [Mapbox token](https://account.mapbox.com) ready, then click the Deploy button and follow the prompts.

[![Deploy](https://get.pulumi.com/new/button.svg)](https://app.pulumi.com/new?template=https://github.com/cnunciato/photomap/tree/master)

## How does it work?

This example uses Pulumi with AWS [S3](https://docs.aws.amazon.com/s3/), [DynamoDB](https://docs.aws.amazon.com/dynamodb/), [Lambda](https://docs.aws.amazon.com/lambda/) and [API Gateway](https://docs.aws.amazon.com/apigateway/) to create the infrastructure for handling photo uploads and showing them as markers on a map. Once deployed, you can upload your GPS-tagged photos directly to the S3 bucket created by the program, then browse to the API Gateway to see them in the browser.

![Architecture diagram](https://user-images.githubusercontent.com/274700/97766980-6ed97280-1ad6-11eb-8eb1-278bac187535.png)

You can upload your GPS-tagged images directly of course:

```
$ aws s3 cp /path/to/your-photo.jpg s3://$(pulumi stack output bucketID) --acl public-read
```

... although you'll most likely want to use a native app instead, just to make things easier. I like [Dropshare](https://dropshare.app/), but you'll find plenty of others out there as well.

## Comments? Questions?

Feel free to file [GitHub Issues](issues).

## Author

Christian Nunciato (https://github.com/cnunciato)
