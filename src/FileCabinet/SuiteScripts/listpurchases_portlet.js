/**
 *@NApiVersion 2.x
 *@NScriptType Portlet
 */
define(['N/runtime', 'N/https', 'N/record', 'N/ui/serverWidget', 'N/format'],
    function (runtime, https, record, serverWidget, format) {
        function render(params) {

            var cmsPrefix;

            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                cmsPrefix = '';
            } else {
                cmsPrefix = 'matrix.';
            }
            var username = runtime.getCurrentScript().getParameter('custscript_username_lp');
            var password = runtime.getCurrentScript().getParameter('custscript_password_lp');

            var token = authenticate(username, password, cmsPrefix);

            //Get wishlist ID

            customer = record.load({
                type: record.Type.CUSTOMER,
                id: params.entity
            });
            var cms_id = customer.getValue({
                fieldId: 'externalid'
            });
            cms_id = cms_id.substr(1, 8);

            headers = {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'Authorization': 'JWT ' + token
            };
            url = 'https://' + cmsPrefix + 'prezola.com/api/v2/listpurchases/?wishlist=' + cms_id + '&include[]=item.product.brand.title&limit=999' ;
            response = https.get({
                url: url,
                headers: headers,
            });
            log.debug('Body', response.body);
            body_json = JSON.parse(response.body);
            var results = body_json.results;
            var lps = results.list_purchases;

            lps.sort(function(a, b){
                var x = a.item.product.brand.title.toLowerCase();
                var y = b.item.product.brand.title.toLowerCase();
                if (x < y) {return -1;}
                if (x > y) {return 1;}
                return 0;
            });

            log.debug('lps', lps);



            var portlet = params.portlet;
            portlet.title = 'Confirmed and Exchanged List Purchases';
            portlet.addColumn({
                id: 'date',
                type: serverWidget.FieldType.DATE,
                label: 'Date',
                align: 'LEFT'
            });

            portlet.addColumn({
                id: 'sku',
                type: 'text',
                label: 'SKU',
                align: 'LEFT'
            });

            portlet.addColumn({
                id: 'brand',
                type: 'text',
                label: 'Brand',
                align: 'LEFT'
            });

            portlet.addColumn({
                id: 'product',
                type: 'text',
                label: 'Product',
                align: 'LEFT'
            });


            portlet.addColumn({
                id: 'quantity',
                type: 'text',
                label: 'Quantity',
                align: 'LEFT'
            });
            portlet.addColumn({
                id: 'price',
                type: 'currency',
                label: 'Price',
                align: 'LEFT'
            });
            portlet.addColumn({
                id: 'state',
                type: 'text',
                label: 'State',
                align: 'LEFT'
            });



            portlet.addColumn({
                id: 'cms',
                type: 'text',
                label: 'LP on CMS',
                align: 'LEFT'
            });





            for (var i=0; i < lps.length; i++) {

                if ((lps[i].state == 'confirmed' || lps[i].state == 'exchanged')
                    && lps[i].price > 0
                    && lps[i].item.product.pim_id != 'UU04622149'
                    && lps[i].item.product.title.substring(0,7) != 'CV from') {


                    portlet.addRow({
                        date: lps[i].date.substring(0,10),
                        quantity: lps[i].quantity,
                        price: lps[i].price,
                        state: lps[i].state,
                        sku: lps[i].item.product.pim_id,
                        cms: '<A HREF="https://' + cmsPrefix + 'prezola.com/admin/purchases/standardlistpurchase/' + lps[i].id + '">' + lps[i].id + '</A>',
                        product: lps[i].item.product.title,
                        brand: lps[i].item.product.brand.title
                    });
                }

            }
        }

        function authenticate(username, password, cmsPrefix) {

            var headers = {
                'Content-Type': 'application/json',
                "accept": 'application/json'
            };
            var payload = {
                'username': username,
                'password': password
            };
            var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';

            var response = https.post({
                url: url,
                headers: headers,
                body: JSON.stringify(payload)
            });

            var body_json = JSON.parse(response.body);
            var token = body_json.token;
            return token;
        }



        return {
            render: render
        };
    });