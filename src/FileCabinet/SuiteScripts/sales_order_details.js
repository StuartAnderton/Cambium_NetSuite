/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

//  Confirms a purchase order from a client

define(['N/record', 'N/runtime', 'N/https', 'N/crypto'],
    function (record, runtime, https, crypto) {

        var results = []

        function onRequest(context) {

            request = context.request;
            var request = context.request;
            var params = request.parameters;
            var itemsParam = params.items;
            var items = JSON.parse(itemsParam)

            for (var i = 0; i < items.length; i++) {
                var item = processResult(items[i]);
                log.audit('item', item);
                if (item)
                    results.push(item);
            }

            /*             var final = {
                            apiKey: getApiKey(),
                            results: results
                        }
            
                        context.response.write(JSON.stringify(final)); */

            var neoResult = getNeoRequest();

            var final = changeDate(JSON.parse(neoResult));

            context.response.write(JSON.stringify(final));
        }

        function getNeoRequest() {

            if (results.length === 0)
                return JSON.stringify([]);

            var key = getApiKey()

            headers = {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'apiKey': key
            };

            // Endpoint
            url = 'https://' + getPrefix() + 'giftlistmanager.com/netsuite/salesorder/CheckOrderQuantity';

            var response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(results)
            });

            var final = JSON.parse(response.body);

            return JSON.stringify(final);
        }

        function getApiKey() {
            var today = new Date();

            var inputDate = today.getFullYear() + '' +
                ('0' + (today.getMonth() + 1)).slice(-2) + '' +
                ('0' + today.getDate()).slice(-2);

            var hashObj = crypto.createHash({
                algorithm: crypto.HashAlg.SHA256
            });

            hashObj.update({
                input: inputDate
            });

            var hashedValue = hashObj.digest().toLowerCase();
            var apiKey = runtime.getCurrentScript().getParameter('custscript_neo_api_key') + hashedValue;

            return apiKey;
        }

        function getPrefix() {

            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                return 'neo-uk.';
            }
            else {
                return 'qa.';
            }
        }

        function changeDate(neoResults) {

            var final = []

            for (var i = 0; i < neoResults.length; i++) {

                var item = neoResults[i];
                log.audit(item.id, item);
                var order = record.load({
                    type: record.Type.SALES_ORDER,
                    id: item.NetSuiteId
                });

                const lastCommitDate = order.getValue({
                    fieldId: 'custbody_last_commit_date_so'
                });

                item.LastCommitDate = lastCommitDate;

                if (item.lineNumber) {
                    const lastCommittedQuantity = order.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_last_committed_quantity',
                        line: item.lineNumber
                    });

                    item.LastCommittedQuantity = lastCommittedQuantity;
                }

                final.push(item);
            }

            return final;

        }

        function processResult(itemId) {

            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: itemId
            });

            const tranId = salesOrder.getValue({
                fieldId: 'tranid'
            });

            const ownerBrand = salesOrder.getValue({
                fieldId: 'custbodysales_channel'
            });

            const lastCommitDate = salesOrder.getValue({
                fieldId: 'custbody_last_commit_date_so'
            });

            if (!ownerBrand) return;

            if (ownerBrand.indexOf('Prezola') !== -1) {
                log.audit('owner', ownerBrand);
                return false;
            };

            var numLines = salesOrder.getLineCount({
                sublistId: 'item'
            });

            var details = []

            if (numLines > 0) {
                for (var i = 0; i < numLines; i++) {

                    var avialable = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantityavailable',
                        line: i
                    });

                    var quantity = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });

                    var billed = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantitybilled',
                        line: i
                    });

                    var committed = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantitycommitted',
                        line: i
                    });

                    var fulfilled = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantityfulfilled',
                        line: i
                    });

                    var pickPackShip = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantitypickpackship',
                        line: i
                    });

                    var detailId = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_originating_list_purchase_id',
                        line: i
                    });

                    var groupId = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item_display',
                        line: i
                    });

                    var lastCommittedQuantity = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_last_committed_quantity',
                        line: i
                    });

                    details.push({
                        detailId: detailId, avialable: avialable, quantity: quantity, billed: billed, committed: committed, fulfilled: fulfilled, pickPackShip: pickPackShip,
                        groupId: groupId, lastCommittedQuantity: lastCommittedQuantity, lineNumber: i
                    })
                }
            }

            return { netSuiteId: itemId, salesOrderId: tranId, lastCommitDate: lastCommitDate, apiKey: getApiKey(), details: details }
        }

        return {
            onRequest: onRequest
        }
    });
