/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */
/* jshint node: true */

'use strict';

var async = require('async');
var bedrock = require('bedrock');
var config = bedrock.config;
var database = require('bedrock-mongodb');
var uuid = require('uuid').v4;
var brMessagesPush = require('bedrock-messages-push');
var brMessages = require('bedrock-messages');
var brIdentity = require('bedrock-identity');
var brMail = require('bedrock-mail');
var brNotifications = require('bedrock-notifications');

// load config
require('./config');

// configure for tests
bedrock.events.on('bedrock.test.configure', function() {
  require('./test.config');
});

var api = {};
module.exports = api;

bedrock.events.on('bedrock.start', function(callback) {
  brNotifications.register(api);
  callback();
});

var logger = bedrock.loggers.get('app');

api.process = function(options, callback) {
  var messageEmailEventType = config['messages-email'].emailEventType;
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
        brMessages.getMessages(
          null,
          results.pull.messages,
          {recipient: results.pull.recipient},
          callback);
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
        // TODO: Add ability to send out different batches of email
        // based on message type.
        bedrock.events.emitLater({
          type: messageEmailEventType,
          details: {
            messages: results.collect,
            identity: results.identity
          }
        });

        callback();
      }],
      remove: ['email', function(callback, results) {
        brMessagesPush.queue.remove({jobId: jobId}, callback);
      }]
    }, function(err, results) {
      if(err) {
        // If error, jobs will remain in the queue to be
        // completed during another cycle.
        if(err.name === 'NotFound') {
          // Only exception is if Identity no longer exists,
          // then remove the job from the queue and continue
          logger.debug(
            'Removing email job' + jobId +
            ' from queue because its recipient no longer exists');
          return brMessagesPush.queue.remove({jobId: jobId}, callback);
        }
      }
      callback(err, results);
    });
  }, callback);
};

// TODO: Implement an approach that supports internationalization
api.getOptions = function() {
  return {
    label: 'Email',
    type: 'email',
    intervals: [
      {label: 'Daily', value: 'daily'},
      {label: 'Immediate', value: 'immediate'}
    ],
    intervalLabel: 'Email interval',
    defaultUserSettings: config['messages-email'].defaultUserSettings
  };
};
