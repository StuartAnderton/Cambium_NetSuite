/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/file', 'N/runtime'],
    /**
 * @param{file} file
 */
    (file, runtime) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {

            var scriptObj = runtime.getCurrentScript();

            var fileToDelete = scriptObj.getParameter({name: 'custscript_file_to_delete'});

            try {

                var fileObject = file.load({
                    id: fileToDelete
                });

            } catch(err) {

                log.audit('Unable to load ' + fileToDelete, err)
                return

            }

            var fileId = fileObject.id

            file.delete({ id: fileId });

            log.audit(('File Deleted', fileToDelete))

        }

        return {execute}

    });
