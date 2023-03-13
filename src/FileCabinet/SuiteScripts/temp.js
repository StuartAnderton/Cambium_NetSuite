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

        return {
            pageInit: pageInit,
            selectAll: selectAll
        };
    });