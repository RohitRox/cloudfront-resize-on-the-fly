'use strict'

const AWS = require('aws-sdk')
const S3 = new AWS.S3({
  signatureVersion: 'v4',
})
const Sharp = require('sharp')

const Config = require('./config.json')

const SizeMap = {
  thumb: '400x400',
  regular: '900x600',
  large: '1920x1080',
  portrait: '480x600',
}

const SizeMapValues = Object.values(SizeMap)

exports.handler = (event, context, callback) => {
  let response = event.Records[0].cf.response
  let request = event.Records[0].cf.request

  console.log(
    'Response status code: %s, Request Uri: %s',
    response.status,
    request.uri
  )

  //check if image is not present
  if (response.status == 404) {
    // request.uri -> /images/400x400/7Zz7v9GnJ0l1YUhaU3h80.png
    let key = request.uri.substring(1)

    const requestMatches = request.uri.match(
      /\/images\/(\d+)[x|X](\d+)\/([\w-]+).(\w+)/
    )

    if (!requestMatches) {
      callback(null, response)
      return
    }

    const width = parseInt(requestMatches[1], 10)
    const height = parseInt(requestMatches[2], 10)
    const fName = requestMatches[3]
    let fExt = requestMatches[4]

    const dims = `${width}x${height}`

    if (!SizeMapValues.includes(dims)) {
      console.log(
        'Invalid size requested: %s Allowed sizes: %s',
        dims,
        SizeMapValues.join(' ')
      )

      callback(null, response)
      return
    }

    // images/7Zz7v9GnJ0l1YUhaU3h80.png
    const originalKey = `images/${fName}.${fExt}`
    console.log('Bucket: %s, Original Key: %s', Config.bucket.name, originalKey)

    // get the source image file
    S3.getObject({
      Bucket: Config.bucket.name,
      Key: originalKey,
    })
      .promise()
      // perform the resize operation
      .then(data =>
        Sharp(data.Body)
          .resize(width, height, {
            fit: Sharp.fit.inside,
            withoutEnlargement: true,
          })
          .toBuffer()
      )
      .then(buffer => {
        // save the resized object to S3 bucket with appropriate object key.
        S3.putObject({
          Body: buffer,
          Bucket: Config.bucket.name,
          ContentType: 'image/' + fExt,
          CacheControl: 'max-age=31536000',
          Key: key,
          StorageClass: 'STANDARD',
        })
          .promise()
          // even if there is exception in saving the object we send back the generated
          // image back to viewer below
          .catch(() => {
            console.log(
              'Exception while writing resized image to bucket: ',
              err
            )
          })

        // generate a binary response with resized image
        response.status = 200
        response.body = buffer.toString('base64')
        response.bodyEncoding = 'base64'
        response.headers['content-type'] = [
          {
            key: 'Content-Type',
            value: 'image/' + fExt,
          },
        ]

        callback(null, response)
      })
      .catch(err => {
        console.log('Exception while reading source image: ', err)
      })
  } // end of if block checking response statusCode
  else {
    // allow the response to pass through
    callback(null, response)
  }
}
