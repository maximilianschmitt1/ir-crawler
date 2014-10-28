'use strict';

var parse   = require('superagentparse');
var request = require('superagent');
var async   = require('async');
var md5     = require('md5');

var crawler = {
	taskQueue: null,
	maxQueueLength: 24000,
	fetched: {},
	queue: function(url) {
		if (crawler.hasFetched(url) || crawler.isQueued(url)) {
			return;
		}

		if (crawler.queueLength() >= crawler.maxQueueLength) {
			return;
		}

		if (!this.taskQueue) {
			this.taskQueue = async.queue(this.fetchUrl, 5);
		}

		this.taskQueue.push(url);
	},
	hasFetched: function(url) {
		return crawler.fetched[md5.digest_s(url)];
	},
	setFetched: function(url) {
		crawler.fetched[md5.digest_s(url)] = true;
	},
	numFetched: function() {
		return Object.keys(crawler.fetched).length;
	},
	isQueued: function(url) {
		if (!crawler.taskQueue) {
			return false;
		}

		for (var i = 0; i < crawler.taskQueue.tasks.length; i++) {
			var task = crawler.taskQueue.tasks[i];

			if (task.data === url) {
				return true;
			}
		}

		return false;
	},
	queueLength: function() {
		if (!crawler.taskQueue) {
			return 0;
		}

		return crawler.taskQueue.length();
	},
	fetchUrl: function(url, cb) {
		if (crawler.hasFetched(url)) {
			cb();
			return;
		}

		crawler.setFetched(url);

		request
			.get(url)
			.accept('html')
			.parse(parse('utf-8'))
			.on('error', function(e) {
				console.log('!!! Error crawling ' + url);
				console.log(e);
				cb();
			})
			.end(function(res) {
				if (crawler.onUrlFetched) {
					crawler.onUrlFetched(url, res);
				}
				cb();
			});
	},
	stop: function() {
		this.taskQueue.kill();
	}
};

module.exports = crawler;