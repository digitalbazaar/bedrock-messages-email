/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
 /* jshint node: true */

'use strict';

var async = require('async');
var bedrock = require('bedrock');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var uuid = require('node-uuid').v4;
var brMessagesPush = require('bedrock-messages-push');

// load config
require('./config');

// configure for tests
bedrock.events.on('bedrock.test.configure', function() {
  require('./test.config');
});

var logger = bedrock.loggers.get('app');

var api = {};
module.exports = api;

api.process = function(options, callback) {
  var done = false;
  async.until(function() {return done;}, function(callback) {
    var jobId = uuid();
    async.auto({
      pull: function(callback) {
        var o = {
          jobId: jobId,
          method: options.method,
          interval: options.interval
        };
        brMessagesPush.queue.pull(o, callback);
      },
      collect: ['pull', function(callback, results) {
        console.log('PULLRESULTS', results.pull.value);
        if(!results.pull.value) {
          done = true;
          return callback();
        }
        // TODO: pull together details needed to actually generate an email
        // need to get email address, message contents, etc.
        // need to build a single message from all the messages listed in messages array
        callback();
      }],
      remove: ['collect', function(callback, results) {
        brMessagesPush.queue.remove({jobId: jobId}, callback);
      }]
    }, callback);
  }, callback);
};
