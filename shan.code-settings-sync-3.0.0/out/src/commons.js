"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const vscode = require("vscode");
const environmentPath_1 = require("./environmentPath");
const localize_1 = require("./localize");
const fileService_1 = require("./service/fileService");
const setting_1 = require("./setting");
const chokidar = require('chokidar');
const lockfile = require('proper-lockfile');
class Commons {
    constructor(en, context) {
        this.en = en;
        this.context = context;
        this.ERROR_MESSAGE = localize_1.default("common.error.message");
    }
    static LogException(error, message, msgBox, callback) {
        if (error) {
            console.error(error);
            if (error.code == 500) {
                message = localize_1.default("common.error.connection");
                msgBox = false;
            }
            else if (error.code == 4) {
                message = localize_1.default("common.error.canNotSave");
            }
            else if (error.message) {
                try {
                    message = JSON.parse(error.message).message;
                    if (message.toLowerCase() == 'bad credentials') {
                        msgBox = true;
                        message = localize_1.default("common.error.invalidToken");
                        //vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://github.com/settings/tokens'));
                    }
                    if (message.toLowerCase() == 'not found') {
                        msgBox = true;
                        message = localize_1.default("common.error.invalidGistId");
                    }
                }
                catch (error) {
                    //message = error.message;
                }
            }
        }
        if (msgBox == true) {
            vscode.window.showErrorMessage(message);
            vscode.window.setStatusBarMessage("").dispose();
        }
        else {
            vscode.window.setStatusBarMessage(message, 5000);
        }
        if (callback) {
            callback.apply(this);
        }
    }
    StartWatch() {
        return __awaiter(this, void 0, void 0, function* () {
            let lockExist = yield fileService_1.FileService.FileExists(this.en.FILE_SYNC_LOCK);
            if (!lockExist) {
                fs.closeSync(fs.openSync(this.en.FILE_SYNC_LOCK, 'w'));
            }
            let self = this;
            let locked = lockfile.checkSync(this.en.FILE_SYNC_LOCK);
            if (locked) {
                lockfile.unlockSync(this.en.FILE_SYNC_LOCK);
            }
            let uploadStopped = true;
            Commons.extensionWatcher = chokidar.watch(this.en.ExtensionFolder, { depth: 0, ignoreInitial: true });
            Commons.configWatcher = chokidar.watch(this.en.PATH + "/User/", { depth: 2, ignoreInitial: true });
            //TODO : Uncomment the following lines when code allows feature to update Issue in github code repo - #14444
            // Commons.extensionWatcher.on('addDir', (path, stat)=> {
            //     if (uploadStopped) {
            //         uploadStopped = false;
            //         this.InitiateAutoUpload().then((resolve) => {
            //             uploadStopped = resolve;
            //         }, (reject) => {
            //             uploadStopped = reject;
            //         });
            //     }
            //     else {
            //         vscode.window.setStatusBarMessage("");
            //         vscode.window.setStatusBarMessage("Sync : Updating In Progres... Please Wait.", 3000);
            //     }
            // });
            // Commons.extensionWatcher.on('unlinkDir', (path)=> {
            //     if (uploadStopped) {
            //         uploadStopped = false;
            //         this.InitiateAutoUpload().then((resolve) => {
            //             uploadStopped = resolve;
            //         }, (reject) => {
            //             uploadStopped = reject;
            //         });
            //     }
            //     else {
            //         vscode.window.setStatusBarMessage("");
            //         vscode.window.setStatusBarMessage("Sync : Updating In Progres... Please Wait.", 3000);
            //     }
            // });
            Commons.configWatcher.on('change', (path) => __awaiter(this, void 0, void 0, function* () {
                let locked = lockfile.checkSync(this.en.FILE_SYNC_LOCK);
                if (locked) {
                    uploadStopped = false;
                }
                if (uploadStopped) {
                    uploadStopped = false;
                    lockfile.lockSync(self.en.FILE_SYNC_LOCK);
                    let settings = this.GetSettings();
                    let customSettings = yield this.GetCustomSettings();
                    if (customSettings == null) {
                        return;
                    }
                    let requiredFileChanged = false;
                    if (customSettings.ignoreUploadFolders.indexOf("workspaceStorage") == -1) {
                        requiredFileChanged = (path.indexOf(self.en.FILE_SYNC_LOCK_NAME) == -1) && (path.indexOf(".DS_Store") == -1) && (path.indexOf(this.en.APP_SUMMARY_NAME) == -1) && (path.indexOf(this.en.FILE_CUSTOMIZEDSETTINGS_NAME) == -1);
                    }
                    else {
                        requiredFileChanged = (path.indexOf(self.en.FILE_SYNC_LOCK_NAME) == -1) && (path.indexOf("workspaceStorage") == -1) && (path.indexOf(".DS_Store") == -1) && (path.indexOf(this.en.APP_SUMMARY_NAME) == -1) && (path.indexOf(this.en.FILE_CUSTOMIZEDSETTINGS_NAME) == -1);
                    }
                    console.log("Sync : File Change Detected On : " + path);
                    if (requiredFileChanged) {
                        if (settings.autoUpload) {
                            if (customSettings.ignoreUploadFolders.indexOf("workspaceStorage") > -1) {
                                let fileType = path.substring(path.lastIndexOf('.'), path.length);
                                if (fileType.indexOf('json') == -1) {
                                    console.log("Sync : Cannot Initiate Auto-upload on This File (Not JSON).");
                                    uploadStopped = true;
                                    return;
                                }
                            }
                            console.log("Sync : Initiating Auto-upload For File : " + path);
                            this.InitiateAutoUpload(path).then((resolve) => {
                                uploadStopped = resolve;
                                lockfile.unlockSync(self.en.FILE_SYNC_LOCK);
                            }, (reject) => {
                                lockfile.unlockSync(self.en.FILE_SYNC_LOCK);
                                uploadStopped = true;
                            });
                        }
                    }
                    else {
                        uploadStopped = true;
                        lockfile.unlockSync(self.en.FILE_SYNC_LOCK);
                    }
                }
                else {
                    vscode.window.setStatusBarMessage("").dispose();
                    vscode.window.setStatusBarMessage(localize_1.default("common.info.updating"), 3000);
                }
            }));
        });
    }
    InitiateAutoUpload(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                vscode.window.setStatusBarMessage("").dispose();
                vscode.window.setStatusBarMessage(localize_1.default("common.info.initAutoUpload"), 5000);
                setTimeout(function () {
                    vscode.commands.executeCommand('extension.updateSettings', "forceUpdate", path).then((res) => {
                        resolve(true);
                    });
                }, 3000);
            }));
        });
    }
    CloseWatch() {
        if (Commons.configWatcher != null) {
            Commons.configWatcher.close();
        }
        if (Commons.extensionWatcher != null) {
            Commons.extensionWatcher.close();
        }
    }
    InitalizeSettings(askToken, askGist) {
        return __awaiter(this, void 0, void 0, function* () {
            let me = this;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var settings = new setting_1.LocalConfig();
                var extSettings = me.GetSettings();
                var cusSettings = yield me.GetCustomSettings();
                if (cusSettings.token == "") {
                    if (askToken == true) {
                        askToken = !cusSettings.downloadPublicGist;
                    }
                    if (askToken) {
                        if (cusSettings.openTokenLink) {
                            vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://github.com/settings/tokens'));
                        }
                        let tokTemp = yield me.GetTokenAndSave(cusSettings);
                        if (!tokTemp) {
                            vscode.window.showErrorMessage(localize_1.default("common.error.tokenNotSave"));
                            reject(false);
                        }
                        cusSettings.token = tokTemp;
                    }
                }
                if (extSettings.gist == "") {
                    if (askGist) {
                        let gistTemp = yield me.GetGistAndSave(extSettings);
                        if (!gistTemp) {
                            vscode.window.showErrorMessage(localize_1.default("common.error.gistNotSave"));
                            reject(false);
                        }
                        extSettings.gist = gistTemp;
                    }
                }
                settings.customConfig = cusSettings;
                settings.extConfig = extSettings;
                resolve(settings);
            }));
        });
    }
    GetCustomSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            let me = this;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let customSettings = new setting_1.CustomSettings();
                try {
                    let customExist = yield fileService_1.FileService.FileExists(me.en.FILE_CUSTOMIZEDSETTINGS);
                    if (customExist) {
                        let customSettingStr = yield fileService_1.FileService.ReadFile(me.en.FILE_CUSTOMIZEDSETTINGS);
                        let tempObj = JSON.parse(customSettingStr);
                        if (!Array.isArray(tempObj["ignoreUploadSettings"])) {
                            tempObj["ignoreUploadSettings"] = new Array();
                        }
                        Object.assign(customSettings, tempObj);
                        customSettings.token = customSettings.token.trim();
                        resolve(customSettings);
                    }
                }
                catch (e) {
                    Commons.LogException(e, "Sync : Unable to read " + this.en.FILE_CUSTOMIZEDSETTINGS_NAME + ". Make sure its Valid JSON.", true);
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('http://shanalikhan.github.io/2017/02/19/Option-to-ignore-settings-folders-code-settings-sync.html'));
                    customSettings = null;
                    resolve(customSettings);
                }
            }));
        });
    }
    SetCustomSettings(setting) {
        return __awaiter(this, void 0, void 0, function* () {
            let me = this;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    let json = Object.assign(setting);
                    delete json["ignoreUploadSettings"];
                    yield fileService_1.FileService.WriteFile(me.en.FILE_CUSTOMIZEDSETTINGS, JSON.stringify(json));
                    resolve(true);
                }
                catch (e) {
                    Commons.LogException(e, "Sync : Unable to write " + this.en.FILE_CUSTOMIZEDSETTINGS_NAME, true);
                    resolve(false);
                }
            }));
        });
    }
    StartMigrationProcess() {
        let me = this;
        let settingKeys = Object.keys(new setting_1.ExtensionConfig());
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            let settings = yield me.GetSettings();
            let fileExist = yield fileService_1.FileService.FileExists(me.en.FILE_CUSTOMIZEDSETTINGS);
            let customSettings = null;
            let firstTime = !fileExist;
            let fileChanged = firstTime;
            if (fileExist) {
                customSettings = yield me.GetCustomSettings();
            }
            else {
                customSettings = new setting_1.CustomSettings();
            }
            //vscode.workspace.getConfiguration().update("sync.version", undefined, true);
            if (firstTime) {
                const openExtensionPage = localize_1.default("common.action.openExtPage");
                const openExtensionTutorial = localize_1.default("common.action.openExtTutorial");
                vscode.window.showInformationMessage(localize_1.default("common.info.installed"));
                vscode.window.showInformationMessage(localize_1.default("common.info.needHelp"), openExtensionPage).then(function (val) {
                    if (val == openExtensionPage) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=Shan.code-settings-sync'));
                    }
                });
                vscode.window.showInformationMessage(localize_1.default("common.info.excludeFile"), openExtensionTutorial).then(function (val) {
                    if (val == openExtensionTutorial) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('http://shanalikhan.github.io/2017/02/19/Option-to-ignore-settings-folders-code-settings-sync.html'));
                    }
                });
            }
            else if (customSettings.version < environmentPath_1.Environment.CURRENT_VERSION) {
                fileChanged = true;
                if (this.context.globalState.get('synctoken')) {
                    let token = this.context.globalState.get('synctoken');
                    if (token != "") {
                        customSettings.token = String(token);
                        this.context.globalState.update("synctoken", "");
                        vscode.window.showInformationMessage(localize_1.default("common.info.setToken"));
                    }
                }
                const releaseNotes = localize_1.default("common.action.releaseNotes");
                const writeReview = localize_1.default("common.action.writeReview");
                const support = localize_1.default("common.action.support");
                const joinCommunity = localize_1.default("common.action.joinCommunity");
                vscode.window.showInformationMessage(localize_1.default("common.info.updateTo", environmentPath_1.Environment.getVersion()), releaseNotes, writeReview, support, joinCommunity).then(function (val) {
                    if (val == releaseNotes) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('http://shanalikhan.github.io/2016/05/14/Visual-studio-code-sync-settings-release-notes.html'));
                    }
                    if (val == writeReview) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=Shan.code-settings-sync#review-details'));
                    }
                    if (val == support) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=4W3EWHHBSYMM8&lc=IE&item_name=Code%20Settings%20Sync&item_number=visual%20studio%20code%20settings%20sync&currency_code=USD&bn=PP-DonationsBF:btn_donate_SM.gif:NonHosted'));
                    }
                    if (val == joinCommunity) {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://join.slack.com/t/codesettingssync/shared_invite/enQtMzE3MjY5NTczNDMwLTYwMTIwNGExOGE2MTJkZWU0OTU5MmI3ZTc4N2JkZjhjMzY1OTk5OGExZjkwMDMzMDU4ZTBlYjk5MGQwZmMyNzk'));
                    }
                });
            }
            if (fileChanged) {
                customSettings.version = environmentPath_1.Environment.CURRENT_VERSION;
                yield me.SetCustomSettings(customSettings);
            }
            resolve(true);
        }));
    }
    SaveSettings(setting) {
        return __awaiter(this, void 0, void 0, function* () {
            let me = this;
            let config = vscode.workspace.getConfiguration('sync');
            let allKeysUpdated = new Array();
            return new Promise((resolve, reject) => {
                let keys = Object.keys(setting);
                keys.forEach((keyName) => __awaiter(this, void 0, void 0, function* () {
                    if ((keyName == "lastDownload" || keyName == "lastUpload") && setting[keyName]) {
                        try {
                            let zz = new Date(setting[keyName]);
                            setting[keyName] = zz;
                        }
                        catch (e) {
                            setting[keyName] = new Date();
                        }
                    }
                    if (setting[keyName] == null) {
                        setting[keyName] = "";
                    }
                    if (keyName.toLowerCase() == "token") {
                        allKeysUpdated.push(me.context.globalState.update("synctoken", setting[keyName]));
                    }
                    else {
                        allKeysUpdated.push(config.update(keyName, setting[keyName], true));
                    }
                }));
                Promise.all(allKeysUpdated).then(function (a) {
                    if (me.context.globalState.get('syncCounter')) {
                        let counter = me.context.globalState.get('syncCounter');
                        let count = parseInt(String(counter));
                        if (count % 450 == 0) {
                            me.DonateMessage();
                        }
                        count = count + 1;
                        me.context.globalState.update("syncCounter", count);
                    }
                    else {
                        me.context.globalState.update("syncCounter", 1);
                    }
                    resolve(true);
                }, function (b) {
                    Commons.LogException(b, me.ERROR_MESSAGE, true);
                    reject(false);
                });
            });
        });
    }
    DonateMessage() {
        const donateNow = localize_1.default("common.action.donate");
        const writeReview = localize_1.default("common.action.writeReview");
        vscode.window.showInformationMessage(localize_1.default("common.info.donate"), donateNow, writeReview).then((res) => {
            if (res == donateNow) {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=4W3EWHHBSYMM8&lc=IE&item_name=Code%20Settings%20Sync&item_number=visual%20studio%20code%20settings%20sync&currency_code=USD&bn=PP-DonationsBF:btn_donate_SM.gif:NonHosted'));
            }
            else if (res == writeReview) {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=Shan.code-settings-sync#review-details'));
            }
        });
    }
    GetSettings() {
        var me = this;
        let settings = new setting_1.ExtensionConfig();
        let keys = Object.keys(settings);
        keys.forEach(key => {
            if (key != 'token') {
                settings[key] = vscode.workspace.getConfiguration("sync")[key];
            }
        });
        settings.gist = settings.gist.trim();
        return settings;
    }
    GetTokenAndSave(sett) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            var opt = Commons.GetInputBox(true);
            return new Promise((resolve, reject) => {
                (function getToken() {
                    vscode.window.showInputBox(opt).then((token) => __awaiter(this, void 0, void 0, function* () {
                        if (token && token.trim()) {
                            token = token.trim();
                            if (token != 'esc') {
                                sett.token = token;
                                yield me.SetCustomSettings(sett).then(function (saved) {
                                    if (saved) {
                                        vscode.window.setStatusBarMessage(localize_1.default("common.info.tokenSaved"), 1000);
                                    }
                                    resolve(token);
                                }, function (err) {
                                    reject(err);
                                });
                            }
                        }
                    }));
                }());
            });
        });
    }
    GetGistAndSave(sett) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            var opt = Commons.GetInputBox(false);
            return new Promise((resolve, reject) => {
                (function getGist() {
                    vscode.window.showInputBox(opt).then((gist) => __awaiter(this, void 0, void 0, function* () {
                        if (gist && gist.trim()) {
                            gist = gist.trim();
                            if (gist != 'esc') {
                                sett.gist = gist.trim();
                                yield me.SaveSettings(sett).then(function (saved) {
                                    if (saved) {
                                        vscode.window.setStatusBarMessage(localize_1.default("common.info.gistSaved"), 1000);
                                    }
                                    resolve(gist);
                                }, function (err) {
                                    reject(err);
                                });
                            }
                        }
                    }));
                })();
            });
        });
    }
    static GetInputBox(token) {
        if (token) {
            let options = {
                placeHolder: localize_1.default("common.placeholder.enterGithubAccessToken"),
                password: false,
                prompt: localize_1.default("common.prompt.enterGithubAccessToken"),
                ignoreFocusOut: true
            };
            return options;
        }
        else {
            let options = {
                placeHolder: localize_1.default("common.placeholder.enterGistId"),
                password: false,
                prompt: localize_1.default("common.prompt.enterGistId"),
                ignoreFocusOut: true
            };
            return options;
        }
    }
    ;
    /**
     * IgnoreSettings
     */
    GetIgnoredSettings(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            let ignoreSettings = new Object();
            return new Promise((resolve, reject) => {
                let config = vscode.workspace.getConfiguration();
                let keysUpdated = new Array();
                settings.forEach((key, index) => __awaiter(this, void 0, void 0, function* () {
                    let keyValue = null;
                    keyValue = config.get(key, null);
                    if (keyValue != null) {
                        ignoreSettings[key] = keyValue;
                        keysUpdated.push(config.update(key, undefined, true));
                    }
                }));
                Promise.all(keysUpdated).then((a => {
                    resolve(ignoreSettings);
                }), (rej) => {
                    rej(null);
                });
            });
        });
    }
    /**
     * RestoreIgnoredSettings
     */
    SetIgnoredSettings(ignoredSettings) {
        let config = vscode.workspace.getConfiguration();
        let keysUpdated = new Array();
        Object.keys(ignoredSettings).forEach((key, index) => __awaiter(this, void 0, void 0, function* () {
            keysUpdated.push(config.update(key, ignoredSettings[key], true));
        }));
    }
    /**
     * AskGistName
     */
    AskGistName() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                vscode.window.showInputBox({
                    prompt: localize_1.default("common.prompt.multipleGist"),
                    ignoreFocusOut: true,
                    placeHolder: localize_1.default("common.placeholder.multipleGist")
                }).then((value) => {
                    resolve(value);
                });
            });
        });
    }
    ShowSummmaryOutput(upload, files, removedExtensions, addedExtensions, ignoredExtensions, syncSettings) {
        if (Commons.outputChannel === null) {
            Commons.outputChannel = vscode.window.createOutputChannel("Code Settings Sync");
        }
        const outputChannel = Commons.outputChannel;
        outputChannel.clear();
        outputChannel.appendLine(`CODE SETTINGS SYNC ${upload ? "UPLOAD" : "DOWNLOAD"} SUMMARY`);
        outputChannel.appendLine(`Version: ${environmentPath_1.Environment.getVersion()}`);
        outputChannel.appendLine(`--------------------`);
        outputChannel.appendLine(`GitHub Token: ${syncSettings.customConfig.token || "Anonymous"}`);
        outputChannel.appendLine(`GitHub Gist: ${syncSettings.extConfig.gist}`);
        outputChannel.appendLine(`GitHub Gist Type: ${syncSettings.publicGist ? "Public" : "Secret"}`);
        outputChannel.appendLine(``);
        if (!syncSettings.customConfig.token) {
            outputChannel.appendLine(`Anonymous Gist cannot be edited, the extension will always create a new one during upload.`);
        }
        outputChannel.appendLine(`Restarting Visual Studio Code may be required to apply color and file icon theme.`);
        outputChannel.appendLine(`--------------------`);
        outputChannel.appendLine(`Files ${upload ? "Upload" : "Download"}ed:`);
        files
            .filter(item => item.fileName.indexOf(".") > 0)
            .forEach(item => {
            if (item.fileName != item.gistName) {
                if (upload) {
                    outputChannel.appendLine(`  ${item.fileName} > ${item.gistName}`);
                }
                else {
                    outputChannel.appendLine(`  ${item.gistName} > ${item.fileName}`);
                }
            }
        });
        outputChannel.appendLine(``);
        outputChannel.appendLine(`Extensions Ignored:`);
        if (!ignoredExtensions || ignoredExtensions.length === 0) {
            outputChannel.appendLine(`  No extensions ignored.`);
        }
        else {
            ignoredExtensions.forEach(extn => {
                outputChannel.appendLine(`  ${extn.name} v${extn.version}`);
            });
        }
        outputChannel.appendLine(``);
        outputChannel.appendLine(`Extensions Removed:`);
        if (!syncSettings.extConfig.removeExtensions) {
            outputChannel.appendLine(`  Feature Disabled.`);
        }
        else {
            if (!removedExtensions || removedExtensions.length === 0) {
                outputChannel.appendLine(`  No extensions removed.`);
            }
            else {
                removedExtensions.forEach(extn => {
                    outputChannel.appendLine(`  ${extn.name} v${extn.version}`);
                });
            }
        }
        if (addedExtensions) {
            outputChannel.appendLine(``);
            outputChannel.appendLine(`Extensions Added:`);
            if (addedExtensions.length === 0) {
                outputChannel.appendLine(`  No extensions installed.`);
            }
            addedExtensions.forEach(extn => {
                outputChannel.appendLine(`  ${extn.name} v${extn.version}`);
            });
        }
        outputChannel.appendLine(`--------------------`);
        outputChannel.append(`Done.`);
        outputChannel.show(true);
    }
    ;
}
Commons.configWatcher = null;
Commons.extensionWatcher = null;
Commons.outputChannel = null;
exports.default = Commons;
//# sourceMappingURL=commons.js.map