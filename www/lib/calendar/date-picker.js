define([
    'jquery',
    '/lib/datepicker/flatpickr.js',

    'css!/lib/datepicker/flatpickr.min.css',
], function ($, Flatpickr) {
    var createRangePicker = function (cfg) {
        var start = cfg.startpicker;
        var end = cfg.endpicker;

        var is24h = false
        var dateFormat = "d.m.Y H:i";
        var locale = {
                firstDayOfWeek: 1,
                weekAbbreviation: "KW",
                weekdays: {
                    shorthand: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
                    longhand: ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"],
                },
                months: {
                    shorthand: ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"],
                    longhand: [
                        "Januar",
                        "Februar",
                        "März",
                        "April",
                        "Mai",
                        "Juni",
                        "Juli",
                        "August",
                        "September",
                        "Oktober",
                        "November",  
                        "Dezember",
                    ],
                },
            };
        try {
            is24h = !new Intl.DateTimeFormat(navigator.language, { hour: 'numeric' }).format(0).match(/AM/);
        } catch (e) {}
        if (!is24h) { dateFormat = "Y-m-d h:i K"; }

        var e = $(end.input)[0];
        var endPickr = Flatpickr(e, {
            locale: locale,
            enableTime: true,
            time_24hr: is24h,
            dateFormat: dateFormat,
            minDate: start.date
        });
        endPickr.setDate(end.date);

        var s = $(start.input)[0];
        var startPickr = Flatpickr(s, {
            locale: locale,
            enableTime: true,
            time_24hr: is24h,
            dateFormat: dateFormat,
            onChange: function () {
                endPickr.set('minDate', startPickr.parseDate(s.value));
            }
        });
        startPickr.setDate(start.date);
        window.CP_startPickr = startPickr;
        window.CP_endPickr = endPickr;

        var getStartDate = function () {
            setTimeout(function () { $(startPickr.calendarContainer).remove(); });
            return startPickr.parseDate(s.value);
        };
        var getEndDate = function () {
            setTimeout(function () { $(endPickr.calendarContainer).remove(); });
            var d = endPickr.parseDate(e.value);

            if (endPickr.config.dateFormat === "Y-m-d") { // All day event
                // Tui-calendar will remove 1s (1000ms) to the date for an unknown reason...
                d.setMilliseconds(1000);
            }

            return d;
        };

        return {
            getStartDate: getStartDate,
            getEndDate: getEndDate,
        };
    };
    return {
        createRangePicker: createRangePicker
    };
});
