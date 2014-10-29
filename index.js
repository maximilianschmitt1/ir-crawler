'use strict';

var memwatch = require('memwatch');
var heapdump = require('heapdump');

memwatch.on('leak', function(info) {
	console.log('Memory leak detected: ' + info.reason);
	heapdump.writeSnapshot();
});

var request     = require('superagent');
var cheerio     = require('cheerio');
var url         = require('url');
var crawler     = require('./crawler');

var followLinks = true;
var numDocs     = 0;
var indexMax    = 24000;
var domain      = /(http:\/\/|https:\/\/)(.*)\.uni-regensburg\.de\.*/;
var startUrl    = 'http://www.uni-regensburg.de';

crawler.maxQueueLength = 1000;

crawler.onUrlFetched = function(currentUrl, res) {
	if (!isValidResponse(res)) {
		return;
	}

	if (numDocs >= indexMax) {
		crawler.stop();
		return;
	}

	numDocs++;

	if (followLinks) {
		queueLinks(res.text, currentUrl);
	}

	postToSolr(res.text, currentUrl);
};

crawler.queue(startUrl);

function isValidResponse(res) {
	return (
		res.type === 'text/html' &&
		typeof res.text !== 'undefined' &&
		res.statusCode === 200
	);
}

function queueLinks(html, currentUrl) {
	var links = [];

	if (followLinks) {
		links = extractLinks(html, currentUrl);
		links.forEach(crawler.queue.bind(crawler));
	}
}

function extractLinks(html, currentUrl) {
	var $ = cheerio.load(html);
	var links = [];

	$('a').each(function(index, a) {
		var href = unleakString($(a).attr('href'));
		if (href) {
			var nextLink = url.resolve(currentUrl, unleakString(href.split('#')[0]));
			if (domain.test(nextLink)) {
				var parsedUrl = url.parse(nextLink);
				links.push(parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname);
			}
		}
	});

	return links;
}

function extractRelevantContent(html, currentUrl) {
	var $ = cheerio.load(html);

	$('.navigation').remove();
	$('script').remove();
	$('style').remove();
	$('.menu-left').remove();

	var title       = unleakString($('title').text());
	var content     = unleakString($('body').text().split(/\s+/).join(' ').trim());
	var description = unleakString($('meta[name=description]').attr('content'));
	var keywords    = unleakString($('meta[name=keywords]').attr('content'));

	return {
		id: currentUrl,
		url: currentUrl,
		title: title,
		content: content,
		description: description,
		keywords: keywords
	};
}

function postToSolr(html, currentUrl) {
	var solrRequest = {
		add: {
			doc: extractRelevantContent(html, currentUrl)
		}
	};

	request
		.post('localhost:8983/solr/update/?commit=true')
		.send(solrRequest)
		.end(function(err, res) {
			if (err) {
				console.log('!!! Error posting to solr. URL: ' + currentUrl);
				console.log(err);
				return;
			}

			console.log('(' + numDocs + ' ' + ' - ' + crawler.numFetched() + ' / ' + crawler.queueLength() + ') ' + currentUrl);
		});
}

function unleakString(s) {
	return (' ' + s).replace(/^\s/, '');
}