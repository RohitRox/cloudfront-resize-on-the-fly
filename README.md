## CDK TypeScript project for building a generic cloudfront+lambda@edge based image delivery service with resize on the fly capability

This is a AWS CDK Typescript project that deploy three main AWS Components: a S3 bucket, a Cloudfront distribution with the bucket as origin and a Lambda@Edge that hooks up as Cloudfront's Origin response function.

The project demonstrates how we can use Cloudfront+Lambda@Edge to dynamically generate and cache content.

The usecase is to be able to generate images of various sizes on the fly/ondemand without having to manually process each image.

For customizing cache behavior in a Amazon CloudFront, we can add up to 4 triggers/Lambda functions to at different CloudFront events:

![cfn-trigger-funcs.png](sample/cfn-trigger-funcs.png)

We are only using CloudFront Origin Response – which executes after CloudFront receives a response from S3 origin and before it caches the object in the response.

In between, if we don't find any image at S3 origin (returns 404), we generate the new/resized image using [Sharp](https://www.npmjs.com/package/sharp) library, save it back to the bucket and new image is sent to user and cached.


Operations:

  1. Request to retrieve image
    Eg: https://d1s7gw4juqriqj.cloudfront.net/images/pic-1.jpg

  2. Origin response function is called, the image is in S3 images folder, image is returned and cache. Next time for same image, it is returned from the cache directly.

  3. Request to retrieve image
    Eg: https://d1s7gw4juqriqj.cloudfront.net/images/400x400/pic-1.jpg

  4. Origin response function is called, the image is not resized yet, so S3 returns 404. The lambda then, fetches the original images - `images/pic-1.jpg`, resized and saves it back at `images/400x400/pic-1.jpg` and returns the image and cloudfront caches.

  5. Next time for same resized image; https://d1s7gw4juqriqj.cloudfront.net/images/400x400/pic-1.jpg, image will be returned from cache.


## Deploy & Testing

```bash
  # provision resources the AWS CDK needs to perform the deployment. These resources include an Amazon S3 bucket for storing files and IAM roles that grant permissions needed to perform deployments.
  $ npm run cdk:bootstrap

  # IMP!
  # set variable config.json to desired values

  # deploy whole stack
  $ npm run cdk:deploy
```

```bash
  # copy sample image to bucket's images folder
  # rename <bucket-name> with your bucket name
  $ aws s3 cp ./sample/pic-1.jpg s3://<bucket-name>/images/pic-1.jpg
```

`npm run cdk:deploy` outputs cloudfront domain name.
It should look like `d1s7gw4juqriqj.cloudfront.net`.

We can then access various image sizes with url:

Original: https://d1s7gw4juqriqj.cloudfront.net/images/pic-1.jpg

Resized to 600x400: https://d1s7gw4juqriqj.cloudfront.net/images/900x600/pic-1.jpg

Resized to 1920x1080: https://d1s7gw4juqriqj.cloudfront.net/images/1920x1080/pic-1.jpg

Allowed resizing parameters and resize configuration can be easily tweaked in origin response [lambda code](lambda/origin-response-handler/index.js).
