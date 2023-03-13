/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 */

//  Confirms a purchase order from a client

define(['N/search', 'N/record'],
    function (search, record) {

        var results = []

        function onRequest(context) {

            request = context.request;
            var request = context.request;
            var params = request.parameters;
            var startDate = params.startDate;
            var endDate = params.endDate;
            var startAt = params.startAt;

            var endAt = +startAt + 100

            log.audit(startDate + ' ' + endDate, startAt + ' ' + endAt)

            var filter = search.createFilter({
                "name": "custbody_last_commit_date_so",
                "operator": search.Operator.WITHIN,
                "values": [startDate, endDate]
            })

            var items = search.create({
                type: search.Type.SALES_ORDER,
                filters: filter
            }).run().getRange(startAt, endAt)

            var count = items.length;

            for (var i = 0; i < items.length; i++) {
                var item = processResult(items[i]);
                if (item)
                    results.push(item);
            }

            context.response.write(JSON.stringify({itemCount: count, results: results}))

        }

        function processResult(result) {

            var exists = salesOrderExists(result.id);

            if (exists) return;

            var salesOrder = record.load({
                type: record.Type.SALES_ORDER,
                id: result.id
            });

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

                    details.push({ detailId: detailId, avialable: avialable, quantity: quantity, billed: billed, committed: committed, fulfilled: fulfilled, pickPackShip: pickPackShip })
                }
            }

            return { netSuiteId: result.id, details: details }
        }

        function salesOrderExists(id) {
            return results.some(function (el) {
                return el.netSuiteId === id;
            });
        }


        return {
            onRequest: onRequest
        }
    });
