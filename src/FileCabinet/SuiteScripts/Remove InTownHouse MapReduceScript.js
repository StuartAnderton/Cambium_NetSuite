/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * Processes removal of InTownhouse flag
 *
 */
define(['N/record', 'N/runtime'],
    /**

     */
    (record, runtime) => {

        const getInputData = (inputContext) => {

            log.debug('Input context', inputContext)

            var me = runtime.getCurrentScript();
            var paramVal = me.getParameter({name: 'custscript_townhouse_param'});
            log.debug('For processing', paramVal)

            return {
                value: paramVal
            }

        }

        const map = (mapContext) => {


            let data = mapContext.value.replace(/(["\[\]])/g, '').split(',');

            log.debug('Map data', data)

            for (let i = 0; i < data.length; i++) {

                mapContext.write({
                    key: i,
                    value: data[i]
                });
            }

        }

        const reduce = (reduceContext) => {

            const itemId = reduceContext.values[0].replace(/\"/g, '')

            //log.debug('processing', itemId)

            try {
                var item = record.load({
                    type: record.Type.INVENTORY_ITEM,
                    id: itemId
                })
            } catch (e){
                log.error('Record load error', e)
            }

            log.debug('Loaded record', item)

            item.setValue({
                fieldId: 'custitemin_townhouse',
                value: false
            })

            item.save()

            log.audit('Set to FALSE', itemId)

        }

        const summarize = (summaryContext) => {
            log.debug('Summary', summaryContext)

        }

        return {getInputData, map, reduce, summarize}

    });
