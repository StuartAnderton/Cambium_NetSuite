/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */


define(['N/url'], function (url) {

    function beforeLoad(context) {

        var form = context.form;

        var ScriptURL = url.resolveScript({
            scriptId: 'customscript_add_contact_note',
            deploymentId: 'customdeployadd_contact_note',
            returnExternalUrl: false,
            params: {'customer_id': context.newRecord.id}
        });

        log.debug('script', [ScriptURL, context]);


        form.addButton({
            id: 'custpage_btn_add_note',
            label: 'Add Contact Note',
            functionName: 'window.open("' + ScriptURL + '", "Add Note", "width=500,height=300,dialog");'
        });
    }

    return {
        beforeLoad: beforeLoad
    }
});
