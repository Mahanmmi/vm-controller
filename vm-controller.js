const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function execCommandSync(cmd) {
    try {
        return execSync(cmd).toString();
    } catch (e) {
        return null;
    }
}

function getVMList() {
    const rawList = execCommandSync('vboxmanage list vms').split('\n');
    rawList.pop();
    const list = [];
    for(const raw of rawList) {
        let name = raw.split(' ');
        name.pop();
        name = name.join(' ');
        list.push(name.substring(1, name.length - 1));
    }
    return list;
}

function Status(vmName) {
    if(vmName) {
        const state = execCommandSync(`vboxmanage showvminfo "${vmName}" | grep State`);
        if (state === null) return null;
        if (state.includes('powered off')) {
            return 'Off';
        } else {
            return 'On';
        }
    }
    const list = getVMList();
    const stateList = {};
    for (const name of list) {
        const state = execCommandSync(`vboxmanage showvminfo "${name}" | grep State`);
        if (state.includes('powered off')) {
            stateList[name] = 'Off';
        } else {
            stateList[name] = 'On';
        }
    }
    return stateList;
}

function OnOff(vmName) {
    if(!vmName) {
        return null;
    }
    const state = execCommandSync(`vboxmanage showvminfo "${vmName}" | grep State`);
    if (state === null) return null;
    if (state.includes('powered off')) {
        const power = execCommandSync(`vboxmanage startvm "${vmName}"`);
        if (power === null) return null;
        return 'powering on';
    } else {
        const power = execCommandSync(`vboxmanage controlvm "${vmName}" poweroff`);
        if (power === null) return null;
        return 'powering off';
    }
}

function Setting(vmName, cpu=1, ram=1024) {
    if(!vmName) {
        return null;
    }
    const state = execCommandSync(`vboxmanage modifyvm "${vmName}" --memory ${ram} --cpus ${cpu}`);
    if (state === null) return null;
    return 'Ok';
}

function Clone(sourceVMName, destVMName=`${sourceVMName} clone`) {
    if(!sourceVMName) {
        return null;
    }
    const state = execCommandSync(`vboxmanage clonevm "${sourceVMName}" --name "${destVMName}" --register`);
    if (state === null) return null;
    return 'Ok';
}

function Delete(vmName) {
    if(!vmName) {
        return null;
    }
    const state = execCommandSync(`vboxmanage unregistervm "${vmName}" --delete`);
    if (state === null) return null;
    return 'Ok';
}

function Execute(vmName, input='pwd') {
    if(!vmName) {
        return null;
    }
    const output = execCommandSync(`vboxmanage guestcontrol "${vmName}" run "/bin/sh" `
        + `--username "${process.env.VM_USER}" --password "${process.env.VM_PASS}" `
        + `--wait-stdout -- -c "${input}" | cat`);
    if (output === null) return null;
    return output.trim();
}

function Transfer(originVM, originPath, destVM, destPath) {
    if(!(originVM && originPath && destVM && destPath)) {
        return null;
    }
    const tmpPath = path.resolve('./tmp/');
    if(!fs.existsSync(tmpPath)) {
        fs.mkdirSync(tmpPath);
    }
    const fileName = path.basename(originPath);
    let state = execCommandSync(`vboxmanage guestcontrol "${originVM}" copyfrom --target-directory "${tmpPath}" "${originPath}" `
        + `--username "${process.env.VM_USER}" --password "${process.env.VM_PASS}"`);
    if (state === null) return null;
    state = execCommandSync(`vboxmanage guestcontrol "${destVM}" copyto --target-directory "${destPath}" "${tmpPath}/${fileName}" `
        + `--username "${process.env.VM_USER}" --password "${process.env.VM_PASS}"`);
    if (state === null) return null;
    fs.rmdirSync(tmpPath, { recursive: true });
    return 'Ok';
}

function Upload(vmName, path, file) {
    if(!vmName) {
        return null;
    }
    const state = execCommandSync(`vboxmanage guestcontrol "${vmName}" copyto --target-directory "${path}" "${file.path}" `
        + `--username "${process.env.VM_USER}" --password "${process.env.VM_PASS}"`);
    if (state === null) return null;
    fs.rmdirSync(file.destination, { recursive: true });
    return 'Ok';
}

module.exports = {
    Status,
    OnOff,
    Setting,
    Clone,
    Delete,
    Execute,
    Transfer,
    Upload
};