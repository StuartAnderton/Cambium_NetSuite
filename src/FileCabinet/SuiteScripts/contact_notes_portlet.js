/**
 *@NApiVersion 2.x
 *@NScriptType Portlet
 */

// Portlet to display balance, add credit on Customer dashboard. Also add Contact Note (because of lack of available Portlets on dash)

define(['N/https', 'N/record', 'N/runtime', 'N/url', 'N/crypto', 'N/encode'],
    function (https, record, runtime, nurl, crypto, encode) {
        function render(params) {

            var cmsPrefix;
            var userObj = runtime.getCurrentUser();
            var submitter = userObj.email;
            var username = runtime.getCurrentScript().getParameter('custscript_balance_username');
            var password = runtime.getCurrentScript().getParameter('custscript_balance_password');
            var apiKey = runtime.getCurrentScript().getParameter('custscript_balance_apikey');

            var credit_url = nurl.resolveScript({
                scriptId: 'customscript_add_credit_to_wl',
                deploymentId: 'customdeploy_add_credit_to_wl',
                returnExternalUrl: false
            });

            
            // ****** Get data
            
            // Get wishlist ID
            
            var customer = record.load({
                type: record.Type.CUSTOMER,
                id: params.entity
            });
            var cust_id = customer.getValue({
                fieldId: 'id'
            });
            var cms_id = customer.getValue({
                fieldId: 'externalid'
            });

            var owning_brand_id = customer.getValue({
                fieldId: 'custentity_owning_brand'
            });

            var isPrezola = owning_brand_id == 9;

            if (runtime.envType === runtime.EnvType.PRODUCTION) {
                if(isPrezola)
                    cmsPrefix = '';
                else
                    cmsPrefix = 'neo-uk.'
            } else {
                if(isPrezola)
                    cmsPrefix = 'matrix.';
                else
                    cmsPrefix = 'qa.';
            }

            // Check for PZA List
            var wishlist = '';
            var credit = 0;
            var cash_fund = 0;

            if(isPrezola)
            {
                cms_id = cms_id.substr(1, 8);

                // Authenticate
                var headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                };
                var payload = {'username': username, 'password': password};
                var url = 'https://' + cmsPrefix + 'prezola.com/api/v2/api-token-auth/';
                var response = https.post({
                    url: url,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
                var body_json = JSON.parse(response.body);
                var token = body_json.token;

                log.debug('Token', token);

                // Get balances

                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'Authorization': 'JWT ' + token
                };
                url = 'https://' + cmsPrefix + 'prezola.com/api/v2/wishlists/' + cms_id + '/';
                response = https.get({
                    url: url,
                    headers: headers
                });
                log.debug('Body', response.body);
                body_json = JSON.parse(response.body);

                wishlist = body_json.wish_list;
                credit = wishlist.credit || 0;
                cash_fund = wishlist.cash_fund_total || 0;

            }else{

                var today = new Date();

                var inputDate = today.getFullYear() + '' +
                    ('0' + (today.getMonth()+1)).slice(-2) + '' +
                    ('0' + today.getDate()).slice(-2);

                var hashObj = crypto.createHash({
                    algorithm: crypto.HashAlg.SHA256
                   });

                hashObj.update({
                    input: inputDate
                });

                var hashedValue = hashObj.digest().toLowerCase();
                
                if(owning_brand_id == 10)
                    cms_id = cms_id.substr(2, cms_id.length);
                else
                    cms_id = cms_id.substr(3, cms_id.length);

                var key = apiKey + hashedValue;

                // Get balances

                headers = {
                    'Content-Type': 'application/json',
                    'accept': 'application/json',
                    'apiKey': key
                };
                url = 'https://' + cmsPrefix + 'giftlistmanager.com/netsuite/GiftList/GetGiftListBalanceData?id=' + cms_id;
                response = https.get({
                    url: url,
                    headers: headers
                });
                log.debug('Body', response.body);

                var body_json = JSON.parse(response.body);
                credit = body_json.total || 0;
                cash_fund = body_json.cash || 0;
            }

            // Create Title

            params.portlet.title = 'Live CMS Data';

            // ***** Create HTML for Portlet

            //Add contacts note and complaints buttons

            var ScriptURL = nurl.resolveScript({
                scriptId: 'customscript_add_contact_note',
                deploymentId: 'customdeployadd_contact_note',
                returnExternalUrl: false,
                params: {'customer_id': params.entity}
            });

            var content =  '<h2> Add Contact Notes</h2>' +
                '<br>\n' +
                ' <table class="uir-button"><tr class="pgBntG pgBntB"><td height="20" valign="top" class="btnBgB" ;">\n' +
                ' <input type="button" style="" class="rndbuttoninpt btnBgT" value="Add Note" id="custpage_btn_add_note" name="custpage_btn_add_note" onclick="window.open(&quot;' + ScriptURL + '&customer_id=' + params.entity + '&quot;, &quot;Add Note&quot;, &quot;width=500,height=300,dialog&quot;)" >' +
                ' </td></tr></table>\n' +
                '<br>\n' +
                '<br>\n';

            content =  content + '<h2> Add Complaint</h2>' +
                '<br>\n' +
                ' <table class="uir-button"><tr class="pgBntG pgBntB"><td height="20" valign="top" class="btnBgB" ;">\n' +
                ' <input type="button" style="" class="rndbuttoninpt btnBgT" value="Add Complaint" id="custpage_btn_add_complaint" name="custpage_btn_add_complaint" onclick="window.open(&quot;/app/common/custom/custrecordentry.nl?rectype=528&record.custrecord_complaining_customer=' + cust_id + '&quot;, &quot;Add Complaint&quot;, &quot;width=800,height=500,dialog&quot;)" >' +
                ' </td></tr></table>\n' +
                '<br>\n';


            // Header info
            content = content +
                '<br>\n' +
                '<div><td><span><b>Current Credit Balance:</b>  £' + credit + '</span></td></div></br>\n' +
                '<div><td><span> <b>Cash Fund:</b> £' + cash_fund + '</span></td></div></br>\n' +
                '    <br>\n';

            if(isPrezola)
            {
                // Add credit form
                content = content +
                    '    <form id="add_credit" method="post" action="' + credit_url + '">\n' +
                    '            <h2>Add Credit to CMS</h2>\n' +
                    '            <p >Adds credit on list in CMS; does not create NetSuite credit</p>\n' +
                    '        </div>\n' +
                    '        <ul style="line-height: 2">\n' +
                    '            <li>\n' +
                    '                <span>\n' +
                    '                <label for="credit">Amount to add</label><br>\n' +
                    '                £ <input id="credit" name="credit" class="element text" style="height: 25px; width: 190px" min="-200" max="200" step="0.01" value="" type="number"> \n' +
                    '                <br></span>\n' +
                    '                <input type="hidden" name="username" value="' + username + '"> \n' +
                    '                <input type="hidden" name="password" value="' + password + '">\n' +
                    '                <input type="hidden" name="cmsid" value="' + cms_id + '">\n' +
                    '                <input type="hidden" name="submitter" value="' + submitter + '">\n' +
                    '                <input type="hidden" name="entityid" value="' + params.entity + '">\n' +
                    '            </li>\n' +
                    '        </ul><br>\n' +
                    '            <table class="uir-button"><tr class="pgBntG pgBntB"><td height="20" valign="top" class="btnBgB" ;">\n' +
                    '                <input id="saveForm" class="rndbuttoninpt btnBgT" type="submit" name="submit" value="Add Credit">\n' +
                    '            </td></tr></table>\n' +
                    '    </form>';
            }

            params.portlet.html = content;
        }

        return {
            render: render
        };
    });