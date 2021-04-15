const fs = require('fs');
const express = require('express');
const multer = require('multer');
const jwt =  require('jsonwebtoken');

const { Status, OnOff, Setting, Clone, Delete, Execute, Transfer, Upload } = require('./vm-controller');

require('dotenv').config();

const app = express();
app.use(express.json());

app.patch('/', async (req, res) => {
    if(req.body.command !== 'login') {
        return res.status(400).send('PATCH endpoint only supports login command');
    }
    switch (req.body.user) {
        case "admin":
            if(req.body.password === process.env.ADMIN_PASS) {
                const token = jwt.sign({user: req.body.user}, process.env.JWT_SECRET);
                return res.send('Bearer ' + token);
            }
            return res.sendStatus(401);
        case "user1":
            if(req.body.password === process.env.USER_PASS) {
                const token = jwt.sign({user: req.body.user}, process.env.JWT_SECRET);
                return res.send('Bearer ' + token);
            }
            return res.sendStatus(401);
        default:
            return res.sendStatus(401);
    }
});

function authMiddleware(req, res, next) {
    const token = req.header('Authorization');
    if (!token) {
        return res.sendStatus(401);
    }
    try {
        const user = jwt.verify(token.substring('Bearer '.length), process.env.JWT_SECRET).user;
        const vmName = req.body.vmName;
        switch (user) {
            case 'admin':
                return next();
            case 'user1':
                if(vmName === 'VM1') {
                    return next();
                }
                return res.sendStatus(401);
            default:
                return res.sendStatus(401);
        }
    } catch (e) {
        return res.sendStatus(401);
    }
}

app.post('/', authMiddleware, async (req, res) => {
    switch (req.body.command) {
        case 'status': {
            const status = Status(req.body.vmName);
            if (status === null) {
                return res.status(400).send('VM not found');
            }
            if(typeof status ===  'string') {
                return res.send({
                    command: req.body.command,
                    vmName: req.body.vmName,
                    status
                });
            }
            const details = [];
            for (const name in status) {
                details.push({vmName: name, status: status[name]});
            }
            return res.send({
                command: req.body.command,
                vmName: req.body.vmName,
                details
            });
        }
        case 'on/off': {
            const power = OnOff(req.body.vmName);
            if (power === null) {
                return res.status(400).send('VM not found');
            }
            return res.send({
                command: req.body.command,
                vmName: req.body.vmName,
                status: power
            });
        }
        case 'setting': {
            const status = Setting(req.body.vmName, req.body.cpu, req.body.ram);
            if (status === null) {
                return res.status(400).send('VM not found');
            }
            return res.send({
                command: req.body.command,
                vmName: req.body.vmName,
                cpu: req.body.cpu,
                ram: req.body.ram,
                status
            });
        }
        case 'clone': {
            const status = Clone(req.body.sourceVmName, req.body.destVmName);
            if (status === null) {
                return res.status(400).send('VM not found');
            }
            return res.send({
                command: req.body.command,
                sourceVmName: req.body.sourceVmName,
                destVmName: req.body.destVmName,
                status
            });
        }
        case 'delete': {
            const status = Delete(req.body.vmName);
            if (status === null) {
                return res.status(400).send('VM not found');
            }
            return res.send({
                command: req.body.command,
                vmName: req.body.vmName,
                status
            });
        }
        case 'execute': {
            const output = Execute(req.body.vmName, req.body.input);
            if (output === null) {
                return res.status(400).send('An error occurred, check vm name, its power status and input');
            }
            return res.send({
                command: req.body.command,
                vmName: req.body.vmName,
                response: output
            });
        }
        case 'transfer': {
            const status = Transfer(req.body.originVM, req.body.originPath, req.body.destVM, req.body.destPath);
            if (status === null) {
                return res.status(400).send('An error occurred check vm names, their power status and paths');
            }
            return res.send({
                command: req.body.command,
                originVM: req.body.originVM,
                originPath: req.body.originPath,
                destVM: req.body.destVM,
                destPath: req.body.destPath,
                status
            });
        }
        default: {
            return res.status(400).send('Unsupported command, supported commands on POST are: ' +
                'status, on/off, setting, clone, delete, execute, transfer.' +
                ' Use PATCH for login and PUT for upload');
        }
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        if(!fs.existsSync('./tmp')){
            fs.mkdirSync('./tmp');
        }
        callback(null, './tmp');
    },
    filename: function (req, file, callback) {
        callback(null, file.originalname);
    }
});
const upload = multer({ storage });

app.put('/', authMiddleware, upload.single('file'), async (req, res) =>{
    if(req.body.command !== 'upload') {
        return res.status(400).send('PUT endpoint only supports upload command');
    }
    const status = Upload(req.body.vmName, req.body.path, req.file);
    if (status === null) {
        return res.status(400).send('An error occurred check vm name, its power status and paths');
    }
    return res.send({
        command: req.body.command,
        vmName: req.body.vmName,
        path: req.body.path,
        status
    });
});

app.listen(process.env.PORT, () => {
    console.log('Server is running on localhost:' + process.env.PORT);
});

