import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// exif-parser lets you extract image metadata (like GPS latitudes and longitudes)
// from JPG image files with pure JavaScript.
// https://github.com/bwindels/exif-parser
const parser = require("exif-parser");

// Import the configured Mapbox token.
const config = new pulumi.Config();
const mapboxPublicToken = config.require("mapboxPublicToken");

// Create an S3 bucket for receiving image uploads. When you upload images to this bucket,
// make sure you set their `acl` properties as `public-read` as well, to make sure they're
// accessible over the public web. For example, if you were uploading with the AWS CLI,
// you could use:
//
// aws s3 cp "/path/to/image.jpg" "s3://$(pulumi stack output bucketName)" --acl "public-read"
const bucket = new aws.s3.Bucket("images", {

    // Make this bucket visible and accessible to the outside world.
    acl: aws.s3.CannedAcl.PublicRead,

    // Destroy all objects in this bucket when the bucket itself is destroyed.
    forceDestroy: true,
});

// Create a DynamoDB table to store metadata for uploaded images. We aren't storing the
// actual images in DynamoDB, just their metadata (which will include their publicly
// accessible S3 URLs.)
//
// For an explanation of each of these properties and their usage, see the AWS docs:
// https://docs.aws.amazon.com/dynamodb/
// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
const table = new aws.dynamodb.Table("image-metadata", {

    // Images are keyed by creation date, which we store as a number.
    attributes: [{ name: "created", type: "N" }],
    hashKey: "created",

    // DynamoDB has a couple of different pricing plans. Use whichever one's best for you.
    // https://aws.amazon.com/dynamodb/pricing
    billingMode: "PAY_PER_REQUEST",
});

// Handle image uploads. The function body will ultimately be serialized and submitted to
// AWS Lambda, along with an appropriate set of access privileges, by Pulumi automatically.
bucket.onObjectCreated("handler", async (event: aws.s3.BucketEvent) => {

    if (!event.Records) {
        return;
    }

    // Pull the object key (the path, essentially) out of the event.
    const [ record ] = event.Records;
    const objectKey = record.s3.object.key;

    // Get references to the bucket ID and region, for use in creating fully-qualified image URLs.
    const bucketID = bucket.id.get();
    const bucketRegion = bucket.region.get();

    // Fetch the image from S3 as a buffer using the AWS SDK for JavaScript, which ships
    // with @pulumi/aws.
    const s3 = new aws.sdk.S3();
    const buffer = await s3.getObject({
        Bucket: bucketID,
        Key: objectKey,
    }).promise();

    // Extract all EXIF data from the image.
    // https://en.wikipedia.org/wiki/Exif
    const exif = parser.create(buffer.Body).parse();

    // Define the metadata record we'll be storing in DynamoDB for this image.
    const image = {
        s3: {
            bucketID,
            bucketRegion,
            objectKey,
            url: `http://${bucketID}.s3-${bucketRegion}.amazonaws.com/${objectKey}`,
        },
        gps: {
            lat: exif.tags.GPSLatitude,
            long: exif.tags.GPSLongitude,
        },
    };

    // Write the metadata record to DynamoDB.
    const client = new aws.sdk.DynamoDB.DocumentClient();
    await client.put({
        TableName: table.name.get(),
        Item: {
            created: new Date().getTime(),
            image,
        }
    }).promise();
});

// Create an AWS API Gateway instance to serve the website and API endpoints.
// https://docs.aws.amazon.com/apigateway/
const api = new awsx.apigateway.API("api", {
    routes: [

        // The root endpoint just serves up a web page. Pulumi will upload whatever
        // content exists at the specified path by creating an S3 bucket and applying the
        // proper access controls.
        {
            path: "/",
            localPath: "www",
        },

        // The /settings endpoint returns settings for use on the client -- currently, just the configured Mapbox public token.
        {
            path: "/settings",
            method: "GET",
            eventHandler: async () => {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ mapboxPublicToken }),
                };
            },
        },

        // The /markers endpoint returns a list of image metadata records, which we use
        // to place markers on the map.
        {
            path: "/markers",
            method: "GET",
            eventHandler: async () => {

                // Fetch all image records from the DynamoDB table.
                const client = new aws.sdk.DynamoDB.DocumentClient();
                const items = await client.scan({
                    TableName: table.name.get(),
                    ProjectionExpression: "created, image",
                }).promise();

                // Return the records as a stringified JSON array.
                return {
                    statusCode: 200,
                    body: JSON.stringify(items.Items),
                };
            },
        },
    ],
});

// Export the ID of the image bucket. You'll need this ID in order to upload your images.
export const bucketID = bucket.id;

// Export the name of the DynamoDB table. You don't necessarily need this, but it's helpful for
// querying and debugging.
export const tableName = table.name;

// Export the URL of the API Gateway instance (and therefore your website!).
export const apiURL = api.url;
