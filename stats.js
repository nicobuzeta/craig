#!/usr/bin/env node
/*
 * Copyright (c) 2018 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
const fs = require("fs");

var log = fs.readFileSync(process.argv[2], "utf8");
var lines = log.split("\n");
var events = [];
var recordings = {};
var stats = {
    totalRecordings: 0,
    last30Days: 0,
    totalTime: 0,
    totalTimeLast30Days: 0,
    maxSimultaneous: 0,
    averagePerDay: 0,
    averageLast30Days: 0
};
for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (line.match(/^....-..-..T..:..:...[0-9]*Z:/)) {
        // It's a log line
        var m = line.match(/(.*): Started.*with ID ([0-9]*)/);
        if (m && m[2]) {
            // Started recording
            var rec = {
                id: m[2],
                start: new Date(m[1]),
                end: null,
                endEvent: -1
            };

            rec.startEvent = events.length;
            events.push({event: "start", rec: rec});
            recordings[m[2]] = rec;
            continue;
        }

        m = line.match(/(.*): Finished.*with ID ([0-9]*)/);
        if (m && m[2]) {
            // Stopped recording
            var rec = recordings[m[2]];
            if (!rec) continue;

            rec.end = new Date(m[1]);
            rec.endEvent = events.length;
            events.push({event: "end", rec: rec});
            delete recordings[m[2]];
            continue;
        }
    }
}

// Figure out when the log starts
var logStart = new Date();
if (events.length)
    logStart = events[0].rec.start;

// Figure out when the last 30 days starts
var last30 = new Date();
for (var ei = events.length - 1; ei >= 0; ei--) {
    var ev = events[ei];
    if (ev.event === "end") {
        last30 = new Date(ev.rec.end.getTime() - (30*24*60*60*1000));
        break;
    }
}

// Get all the stats
var curSimultaneous = 0;
for (var ei = 0; ei < events.length; ei++) {
    var ev = events[ei];
    var rec = ev.rec;
    if (ev.event === "start") {
        // Starting a recording
        if (rec.endEvent < 0) continue;

        curSimultaneous++;
        if (curSimultaneous > stats.maxSimultaneous)
            stats.maxSimultaneous = curSimultaneous;

    } else if (ev.event === "end") {
        // Ending a recording
        var length = rec.end - rec.start;
        stats.totalTime += length/1000;
        if (rec.end >= last30)
            stats.totalTimeLast30Days += length/1000;

        if (length > 120000) {
            stats.totalRecordings++;
            if (rec.end >= last30)
                stats.last30Days++;
        }

        curSimultaneous--;

    }
}

// And the averages
stats.averagePerDay = stats.totalRecordings / ((Date.now() - logStart.getTime()) / (1000*60*60*24));
stats.averageLast30Days = stats.last30Days / 30;

// Now sort it for output
var tm = stats.totalTime;
var days = Math.floor(tm / 86400);
tm -= days * 86400;
var hours = Math.floor(tm / 3600);
tm -= hours * 3600;
var minutes = Math.floor(tm / 60);
tm -= minutes * 60;
tm = Math.floor(tm);

if (process.argv[3] && process.argv[3] === "json") {
    stats.totalTimeSplit = {
        "d": days,
        "h": hours,
        "m": minutes,
        "s": tm
    };
    console.log(JSON.stringify(stats));

} else {
    console.log("Total recordings:\t" + stats.totalRecordings);
    console.log("Total recording time:");
    console.log("\t" + days + " days");
    console.log("\t" + hours + " hours");
    console.log("\t" + minutes + " minutes");
    console.log("\t" + tm + " seconds");
    console.log("Max simultaneous:\t" + stats.maxSimultaneous);
    console.log("Average per day:\t" + Math.round(stats.averagePerDay));
    console.log("Recent recordings/day:\t" + Math.round(stats.averageLast30Days));
    console.log("Recent time/day:\t" + Math.round(stats.totalTimeLast30Days/60/60/30) + " hours");

}
