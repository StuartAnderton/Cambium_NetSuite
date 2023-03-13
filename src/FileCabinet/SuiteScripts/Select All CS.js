/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define(['N/record', 'N/url', 'N/currentRecord'],
    function(record, url, currentRecord) {
        function pageInit(scriptContext) {
            log.debug('init context', scriptContext)
        }
        function selectAll() {

            log.debug('Clicked', '')

            var thisRecord = currentRecord.get()

            log.debug('currentRecord', thisRecord)



            var numLines = thisRecord.getLineCount({
                sublistId: 'item'
            });

            log.debug('lines', numLines)

            for (var i = 0; i < numLines; i++) {

                var lineNum = thisRecord.selectLine({
                    sublistId: 'item',
                    line: i
                });

                log.debug('processing line', i)

                thisRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_select_for_exchange',
                    value: true,
                    ignoreFieldChange: true,
                    fireSlavingSync: false
                });

                thisRecord.commitLine('item')

            }




        }

        function selectAllBackground() {

            log.debug('Clicked', '')

            var thisRecord = currentRecord.get()

            var recordId = thisRecord.id;

            log.debug('currentRecord', thisRecord)
            log.debug('recordId', recordId)

            var editSO = record.load({
                type: record.Type.SALES_ORDER,
                id: recordId
            });


            log.debug('loaded record', editSO)

            var numLines = editSO.getLineCount({
                sublistId: 'item'
            });

            log.debug('lines', numLines)

            for (var i = 0; i < numLines; i++) {

                editSO.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_select_for_exchange',
                    value: true,
                    line: i
                });

            }

            editSO.save()

            var output = url.resolveRecord({
                recordType: record.Type.SALES_ORDER,
                recordId: recordId,
                isEditMode: false
            });

            window.location.replace(output);


        }

        return {
            pageInit: pageInit,
           // selectAll: selectAll,
            selectAllBackground: selectAllBackground
        };
    });