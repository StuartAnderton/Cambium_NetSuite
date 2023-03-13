/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */

define(['N/record', 'N/ui/serverWidget'],
    function (record, serverWidget) {

        function myBeforeLoad(context) {
            var eventType = context.type
            if (eventType != context.UserEventType.EDIT) {return};

            var form = context.form;
            context.form.clientScriptModulePath = 'SuiteScripts/Select All CS.js';
log.debug('script path', context.form.clientScriptModulePath)
            var sublist = form.getSublist({id: 'item'});

            log.debug('id', context)

/*            sublist.addButton({
                id: 'custpage_select_all',
                label: 'Select All',
                functionName: 'selectAll'
            });*/

            sublist.addButton({
                id: 'custpage_select_all_background',
                label: 'Select All',
                functionName: 'selectAllBackground'
            });

        }


        return {
            beforeLoad: myBeforeLoad
        };
    });