// This is the initialization loading the CryptPad libraries
define([
    '/common/sframe-app-framework.js',
    '/customize/messages.js', // translation keys
    '/bower_components/pako/dist/pako.min.js',
    '/bower_components/js-base64/base64.js',
    '/bower_components/x2js/xml2json.min.js',
    'less!/diagram/app-diagram.less',
    'css!/diagram/drawio.css',
], function (
    Framework,
    Messages,
    pako,
    base64,
    X2JS) {

    // As described here: https://drawio-app.com/extracting-the-xml-from-mxfiles/
    const decompressDrawioXml = function(xmlDocStr) {
        var TEXT_NODE = 3;

        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlDocStr, "application/xml");

        var errorNode = doc.querySelector("parsererror");
        if (errorNode) {
            console.error("error while parsing", errorNode);
            return xmlDocStr;
        }

        doc.firstChild.removeAttribute('modified');
        doc.firstChild.removeAttribute('agent');
        doc.firstChild.removeAttribute('etag');

        var diagrams = doc.querySelectorAll('diagram');

        diagrams.forEach(function(diagram) {
            if (diagram.firstChild && diagram.firstChild.nodeType === TEXT_NODE)  {
                const innerText = diagram.firstChild.nodeValue;
                const bin = base64.toUint8Array(innerText);
                const xmlUrlStr = pako.inflateRaw(bin, {to: 'string'});
                const xmlStr = decodeURIComponent(xmlUrlStr);
                const diagramDoc = parser.parseFromString(xmlStr, "application/xml");
                diagram.replaceChild(diagramDoc.firstChild, diagram.firstChild);
            }
        });


        var result = new XMLSerializer().serializeToString(doc);
        return result;
    };

    const deepEqual = function(o1, o2) {
        return JSON.stringify(o1) === JSON.stringify(o2);
    };

    // This is the main initialization loop
    var onFrameworkReady = function (framework) {
        var EMPTY_DRAWIO = "<mxfile type=\"embed\"><diagram id=\"bWoO5ACGZIaXrIiKNTKd\" name=\"Page-1\"><mxGraphModel dx=\"1259\" dy=\"718\" grid=\"1\" gridSize=\"10\" guides=\"1\" tooltips=\"1\" connect=\"1\" arrows=\"1\" fold=\"1\" page=\"1\" pageScale=\"1\" pageWidth=\"827\" pageHeight=\"1169\" math=\"0\" shadow=\"0\"><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root></mxGraphModel></diagram></mxfile>";
        var drawioFrame = document.querySelector('#cp-app-diagram-content');
        var x2js = new X2JS();
        var lastContent = x2js.xml_str2json(EMPTY_DRAWIO);
        var drawIoInitalized = false;

        var postMessageToDrawio = function(msg) {
            if (!drawIoInitalized) {
                console.log('draw.io postMessageToDrawio blocked', msg);
                return;
            }

            console.log('draw.io postMessageToDrawio', msg);
            drawioFrame.contentWindow.postMessage(JSON.stringify(msg), '*');
        };

        const jsonContentAsXML = (content) => x2js.json2xml_str(content);

        var onDrawioInit = function() {
            drawIoInitalized = true;
            var xmlStr = jsonContentAsXML(lastContent);
            postMessageToDrawio({
                action: 'load',
                xml: xmlStr,
                autosave: 1
            });
        };

        const xmlAsJsonContent = (xml) => {
            var decompressedXml = decompressDrawioXml(xml);
            return x2js.xml_str2json(decompressedXml);
        };

        var onDrawioChange = function(newXml) {
            var newJson = xmlAsJsonContent(newXml);
            if (!deepEqual(lastContent, newJson)) {
                lastContent = newJson;
                framework.localChange();
            }
        };

        var onDrawioAutosave = function(data) {
            onDrawioChange(data.xml);

            // Tell draw.io to hide "Unsaved changes" message
            postMessageToDrawio({action: 'status', message: '', modified: false});
        };

        var drawioHandlers = {
            init: onDrawioInit,
            autosave: onDrawioAutosave,
        };

        // This is the function from which you will receive updates from CryptPad
        framework.onContentUpdate(function (newContent) {
            lastContent = newContent;
            var xmlStr = jsonContentAsXML(lastContent);
            postMessageToDrawio({
                action: 'merge',
                xml: xmlStr,
            });

            framework.localChange();
        });

        // This is the function called to get the current state of the data in your app
        framework.setContentGetter(function () {
            return lastContent;
        });

        framework.setFileImporter(
            {accept: ['.drawio',  'application/x-drawio']},
            (content) => {
                return xmlAsJsonContent(content);
            }
        );

        framework.setFileExporter(
            '.drawio',
            () => {
                return new Blob([jsonContentAsXML(lastContent)], {type: 'application/x-drawio'});
            }
        );

        framework.onEditableChange(function () {
            const editable = !framework.isLocked() && !framework.isReadOnly();
            postMessageToDrawio({
                action: 'spinner',
                message: Messages.reconnecting,
                show: !editable
            });

            document.getElementById('overlay').className = editable
                ? ""
                : "show";
        });

        // starting the CryptPad framework
        framework.start();

        drawioFrame.src = '/bower_components/drawio/src/main/webapp/index.html?'
            + new URLSearchParams({
                // pages: 0,
                // dev: 1,
                test: 1,
                stealth: 1,
                embed: 1,
                drafts: 0,

                chrome: framework.isReadOnly() ? 0 : 1,
                dark: window.CryptPad_theme === "dark" ? 1 : 0,

                // Hide save and exit buttons
                noSaveBtn: 1,
                saveAndExit: 0,
                noExitBtn: 1,

                modified: 'unsavedChanges',
                proto: 'json',
            });

        window.addEventListener("message", (event) => {
            if (event.source === drawioFrame.contentWindow) {
                var data = JSON.parse(event.data);
                console.log('draw.io got message', data);
                var eventType = data.event;
                var handler = drawioHandlers[eventType];
                if (handler) {
                    handler(data);
                }
            }
        }, false);
    };

    // Framework initialization
    Framework.create({
        toolbarContainer: '#cme_toolbox',
        contentContainer: '#cp-app-diagram-editor',
        // validateContent: validateXml,
    }, function (framework) {
        onFrameworkReady(framework);
    });
});