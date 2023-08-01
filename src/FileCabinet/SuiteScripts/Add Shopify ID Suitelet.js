/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/search', 'N/runtime', 'N/https'],
    /**

     */
    (record, search, runtime, https) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {


            const itemid = scriptContext.request.parameters.itemid
            const shopifyid = scriptContext.request.parameters.shopifyid
            const variantid = scriptContext.request.parameters.variantid

            log.debug('Procesing', [itemid, shopifyid])

            const itemSearchColInternalId = search.createColumn({name: 'internalid'});
            const itemSearch = search.create({
                type: 'item',
                filters: [
                    ['name', 'is', itemid],
                ],
                columns: [
                    itemSearchColInternalId,
                ],
            });

            const result = itemSearch.run().getRange({start: 0, end: 1})[0]

            const internalId = result.getValue(itemSearchColInternalId);

            const item = record.load({
                type: record.Type.INVENTORY_ITEM,
                id: internalId
            })

            if (shopifyid) {
                item.setValue({
                    fieldId: 'custitem_shopify_product_id',
                    value: shopifyid
                })
            }
            if (variantid) {
                item.setValue({
                    fieldId: 'custitem_shopify_variant',
                    value: variantid
                })
            }

            item.save()

            var jsonRecord = JSON.stringify(item);
            log.debug({
                title: jsonRecord
            });
            var zapier = runtime.getCurrentScript().getParameter('custscript_zapier_endpoint_np');
            var headers = [];
            headers['Content-Type'] = 'application/json';
            var response = https.post({
                url: zapier,
                body: jsonRecord,
                headers: headers

            });
            log.debug('Response', response)


        }

        return {onRequest}

    });
