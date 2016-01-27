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
var brMessages = require('bedrock-messages');
var brIdentity = require('bedrock-identity');
var brMail = require('bedrock-mail');

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
        if(!results.pull) {
          done = true;
          return callback();
        }
        brMessages.getMessages(null, results.pull.messages, {recipient: results.pull.recipient}, callback);
      }],
      identity: ['pull', function(callback, results) {
        if(!results.pull) {
          done = true;
          return callback();
        }
        brIdentity.get(null, results.pull.recipient, function(err, identity) {
          callback(err, identity);
        });
      }],
      email: ['collect', 'identity', function(callback, results) {
        if(!results.collect || !results.identity) {
          done = true;
          return callback();
        }
        // FIXME: Move the type beging emitted to some kind of config defined
        //        higher up
        bedrock.events.emitLater({
          type: 'myProject.emailMessageEvent',
          details: {messages: results.collect,
                    identity: results.identity}
        });

        callback();
      }],
      remove: ['email', function(callback, results) {
        brMessagesPush.queue.remove({jobId: jobId}, callback);
      }]
    }, callback);
  }, callback);
};
