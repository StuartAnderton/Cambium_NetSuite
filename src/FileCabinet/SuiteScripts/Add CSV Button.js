/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */


define(['N/record', 'N/search', 'N/url'],

    // Add the callback function.
    function (record, search, url) {


        function myBeforeLoad(context) {

            var po = context.newRecord;
            var poId = po.getValue('id');
            var poName = po.getValue('tranid');

            //get the url for the suitelet #1; add customer parameter recId based on this ID
            var buildURL = url.resolveScript({
                'scriptId': 'customscript_po_csv',
                'deploymentId': 'customdeploy_po_csv',
                'returnExternalUrl': true
            }) + '&orderid=' + poId + '&ordername=' + poName;


//hook point for the button that will be fired client side;

            var scr = "require(['N/https', 'N/ui/dialog'], function(https, dialog) { \
            https.get({'url': '" + buildURL + "'}); \
            dialog.alert({\
                title: \"CSV Saved\",\
                message: \"CSV saved in the File Cabinet\",\
});\
        });";

            log.debug('function', scr);

//add button to the form; when clicked, call the scr function
            context.form.addButton({
                id: 'custpage_save_csv',
                label: 'Save as CSV',
                functionName: scr
            })


        }

        // Add the return statement that identifies the entry point functions.
        return {
            beforeLoad: myBeforeLoad
        };
    });