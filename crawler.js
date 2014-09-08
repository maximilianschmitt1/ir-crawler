'use strict';

var request = require('superagent');
var async   = require('async');

var crawler = {
	taskQueue: null,
	fetched: {},
	queue: function(url) {
		if (crawler.fetched[url]) {
			return;
		}

		if (!this.taskQueue) {
			this.taskQueue = async.queue(this.fetchUrl, 5);
		}

		this.taskQueue.push(url);
	},
	fetchUrl: function(url, cb) {
		if (crawler.fetched[url]) {
			cb();
			return;
		}

		crawler.fetched[url] = true;

		request
			.get(url)
			.accept('html')
			.on('error', function() {
				console.log('!!! Error crawling ' + url);
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