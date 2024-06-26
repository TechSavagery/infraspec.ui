/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import * as CamerasModel from './cameras.model.js';

import CameraController from '../../../controller/camera/camera.controller.js';
import MotionController from '../../../controller/motion/motion.controller.js';
import fetch from 'node-fetch';
import { URL } from 'url';

const setTimeoutAsync = (ms) => new Promise((res) => setTimeout(res, ms));

var ip;
var credsRaw;

function getIndex(str, char, n) {
  return str.split(char).slice(0, n).join(char).length;
}

export const insert = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.body.name);

    if (camera) {
      return res.status(409).send({
        statusCode: 409,
        message: 'Camera already exists',
      });
    }

    const rtspStreamRaw = req.body.videoConfig.source.replace('-i ', '');

    const regex = /^rtsp:\/{2}((?:\d+\.){3}\d+):(\d+)\/.*$/;
    const match = rtspStreamRaw.match(regex);
    var ip;
    var port;

    if (match && match.length === 3) {
      ip = match[1];
      port = Number.parseInt(match[2]);
    }

    req.body.ipAddress = `${ip}:${port}`;

    var result = await CamerasModel.createCamera(req.body);

    if (!result) {
      return res.status(409).send({
        statusCode: 409,
        message: 'Camera already exists',
      });
    }

    res.status(201).send({
      name: result.name,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const insertAlert = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.body.camera);

    if (camera == null) {
      return res.status(409).send({
        statusCode: 404,
        message: 'Camera does not exist',
      });
    }

    const result = await CamerasModel.createCameraAlert(req.body);

    if (!result) {
      return res.status(409).send({
        statusCode: 500,
        message: 'Alert Creation Failure',
      });
    }

    res.status(201).send({
      result,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const list = async (req, res, next) => {
  try {
    res.locals.items = await CamerasModel.list();

    return next();
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const listInfo = async (req, res, next) => {
  try {
    let cameras = await CamerasModel.list();
    let camerasFiltered = cameras.map((obj) => {
      var rtspStreamRaw = obj.videoConfig.source.replace('-i ', '');

      if (rtspStreamRaw.includes('@')) {
        const parsedUrl = new URL(rtspStreamRaw);

        // Remove the username and password
        parsedUrl.username = '';
        parsedUrl.password = '';

        const updatedRtspUrl = parsedUrl.toString();
        rtspStreamRaw = updatedRtspUrl;
      }

      const regex = /^rtsp:\/{2}((?:\d+\.){3}\d+):(\d+)\/.*$/;
      const match = rtspStreamRaw.match(regex);
      var ip;
      var port;

      if (match && match.length === 3) {
        ip = match[1];
        port = Number.parseInt(match[2]);
      }

      if (rtspStreamRaw.includes('/2')) {
        rtspStreamRaw = rtspStreamRaw.replace('/2', '/1');
      }

      if (rtspStreamRaw.includes('/3')) {
        rtspStreamRaw = rtspStreamRaw.replace('/3', '/1');
      }

      return {
        name: obj.name,
        online: obj.online,
        mode: obj.mode,
        model: obj.model,
        ipAddress: `${ip}:${port}`,
        mountPosition: obj.mountPosition,
        location: obj.location,
        streamUrl: rtspStreamRaw,
        active: obj.active,
      };
    });
    res.locals.items = camerasFiltered;

    return next();
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    res.status(200).send(camera);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getAlertById = async (req, res) => {
  try {
    const alert = await CamerasModel.findAlertById(req.query.id);

    if (!alert) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Alert does not exist',
      });
    }

    res.status(200).send(alert);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getAlerts = async (req, res) => {
  try {
    const alerts = await CamerasModel.findAlerts();

    res.status(200).send(alerts);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const changeCameraPosition = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    if (camera.iis) {
      ip = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('@') + 1,
        camera.videoConfig.source.lastIndexOf(':')
      );

      credsRaw = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('/') + 2,
        camera.videoConfig.source.lastIndexOf('@')
      );
    } else {
      ip = camera.videoConfig.source.slice(
        getIndex(camera.videoConfig.source, '@', 2) + 1,
        camera.videoConfig.source.lastIndexOf(':')
      );

      credsRaw = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('/') + 2,
        getIndex(camera.videoConfig.source, '@', 2)
      );
    }

    const creds = credsRaw.split(':');
    var positions = [];

    await fetch(
      `http://${ip}/cgi-bin/ptz.cgi?userName=${creds[0]}&password=${creds[1]}&cameraID=1&action=getPosition`,
      {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
      }
    )
      .then((response) => response.text())
      .then((data) => {
        for (const position of data.split(/\r?\n/)) {
          positions.push(position.split('=')[1]);
        }
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });
    await fetch(
      `http://${ip}/cgi-bin/ptz.cgi?userName=${creds[0]}&password=${creds[1]}&cameraID=1&action=setPosition&pan=${
        Number.parseFloat(positions[0]) + Number.parseInt(req.params.pan)
      }&tilt=${positions[1] + req.params.tilt}&zoom=${positions[2] + req.params.zoom}`,
      {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
      }
    )
      .then(function () {
        // handle success
        console.log(
          `Sucessfully moved ${camera.name} pan=${
            Number.parseFloat(positions[0]) + Number.parseInt(req.params.pan)
          }&tilt=${positions[1] + req.params.tilt}&zoom=${positions[2] + req.params.zoom}`
        );
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });

    res.status(200);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getCameraPresets = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    } else if (!camera.type.includes('PTZ')) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Camera does not have PTZ features',
      });
    }

    var presets = [];
    var rawPresets = [];
    var regex = /=(.*)/;

    if (camera.iis) {
      ip = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('@') + 1,
        camera.videoConfig.source.lastIndexOf(':')
      );

      credsRaw = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('/') + 2,
        camera.videoConfig.source.lastIndexOf('@')
      );
    } else {
      ip = camera.videoConfig.source.slice(
        getIndex(camera.videoConfig.source, '@', 2) + 1,
        camera.videoConfig.source.lastIndexOf(':')
      );

      credsRaw = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('/') + 2,
        getIndex(camera.videoConfig.source, '@', 2)
      );
    }

    const creds = credsRaw.split(':');

    try {
      await fetch(
        `http://${ip}/cgi-bin/ptz.cgi?userName=${creds[0]}&password=${creds[1]}&cameraID=1&action=listPreset`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
        }
      )
        .then((response) => response.text())
        .then((data) => {
          rawPresets = data.split(/\r?\n/);
          for (var index = 0; index < rawPresets.length; index++) {
            if (rawPresets[index].startsWith('presetID')) {
              data = {
                presetName: rawPresets[index + 1].match(regex)[1],
                presetId: rawPresets[index].match(regex)[1],
                image: `${rawPresets[index + 1].match(regex)[1].split(' ').join('')}.jpg`,
              };
              presets.push(data);
            }
            //Do something
          }
        });
    } catch {
      console.log('PTZPresets Timeout');
    }

    res.status(200).send(presets);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const goToCameraPreset = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    } else if (!camera.type.includes('PTZ')) {
      return res.status(404).send({
        statusCode: 400,
        message: 'Camera does not have PTZ features',
      });
    }
    if (camera.iis) {
      ip = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('@') + 1,
        camera.videoConfig.source.lastIndexOf(':')
      );

      credsRaw = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('/') + 2,
        camera.videoConfig.source.lastIndexOf('@')
      );
    } else {
      ip = camera.videoConfig.source.slice(
        getIndex(camera.videoConfig.source, '@', 2) + 1,
        camera.videoConfig.source.lastIndexOf(':')
      );

      credsRaw = camera.videoConfig.source.slice(
        camera.videoConfig.source.indexOf('/') + 2,
        getIndex(camera.videoConfig.source, '@', 2)
      );
    }

    const creds = credsRaw.split(':');
    var response = '';

    await fetch(
      `http://${ip}/cgi-bin/ptz.cgi?userName=${creds[0]}&password=${creds[1]}&cameraID=1&action=presetInvoke&presetID=${req.params.id}`,
      {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
      }
    )
      .then((response) => response.text())
      .then((data) => {
        response = data;
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });

    res.status(200).send({ response });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const patchByName = async (req, res) => {
  try {
    if (req.body === undefined || Object.keys(req?.body).length === 0) {
      return res.status(400).send({
        statusCode: 400,
        message: 'Bad request',
      });
    }

    let camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    if (req.body.name && req.params.name !== req.body.name) {
      camera = await CamerasModel.findByName(req.body.name);

      if (camera) {
        return res.status(422).send({
          statusCode: 422,
          message: 'Camera already exists',
        });
      }
    }

    var result = await CamerasModel.patchCamera(req.params.name, req.body);
    var rtspStreamRaw = result.videoConfig.source.replace('-i ', '');

    if (rtspStreamRaw.includes('@')) {
      const parsedUrl = new URL(rtspStreamRaw);

      // Remove the username and password
      parsedUrl.username = '';
      parsedUrl.password = '';

      const updatedRtspUrl = parsedUrl.toString();
      rtspStreamRaw = updatedRtspUrl;
    }

    const regex = /^rtsp:\/{2}((?:\d+\.){3}\d+):(\d+)\/.*$/;
    const match = rtspStreamRaw.match(regex);
    var ip;
    var port;

    if (match && match.length === 3) {
      ip = match[1];
      port = Number.parseInt(match[2]);
    }

    var cameraUpdated = {
      name: result.name,
      online: result.online,
      mode: result.mode,
      model: result.model,
      ipAddress: `${ip}:${port}`,
      mountPosition: result.mountPosition,
      location: result.location,
      streamUrl: rtspStreamRaw,
    };
    res.status(200).send(cameraUpdated);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getStatusByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const status = await CamerasModel.pingCamera(camera, req.query.timeout);

    res.status(200).send({
      status: status ? 'ONLINE' : 'OFFLINE',
    });
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getCameraSettingsByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const cameraSetting = await CamerasModel.getSettingsByName(req.params.name);

    if (!cameraSetting) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera setting not found',
      });
    }

    res.status(200).send(cameraSetting);
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const getSnapshotByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const imageBuffer = await CamerasModel.requestSnapshot(camera, req.query.fromSubSource);

    if (req.query.buffer) {
      res.status(200).send(imageBuffer.toString('base64'));
    } else {
      res.set('Content-Type', 'image/jpeg');
      res.set('Content-Disposition', 'inline');
      res.status(200).send(imageBuffer);
    }
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeByName = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    await CamerasModel.removeByName(req.params.name);

    await new Promise((resolve) => setTimeout(resolve, 10000));

    await res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeAll = async (req, res) => {
  try {
    await CamerasModel.removeAll();

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const removeAllProcessed = async (req, res) => {
  try {
    await CamerasModel.removeAllProcessed();
    await new Promise((resolve) => setTimeout(resolve, 20000));

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const resetMotion = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    MotionController.triggerMotion(camera.name, false);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartPrebuffering = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const controller = CameraController.cameras.get(req.params.name);

    if (!controller || (controller && !controller.prebuffer)) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera controller not exists',
      });
    }

    controller.prebuffer.restart();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const restartVideoanalysis = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const controller = CameraController.cameras.get(req.params.name);

    if (!controller || (controller && !controller.videoanalysis)) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera controller not exists',
      });
    }

    controller.videoanalysis.restart();
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const startMotion = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    MotionController.triggerMotion(camera.name, true);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopPrebuffering = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const controller = CameraController.cameras.get(req.params.name);

    if (!controller || (controller && !controller.prebuffer)) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera controller not exists',
      });
    }

    controller.prebuffer.stop(true);
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};

export const stopVideoanalysis = async (req, res) => {
  try {
    const camera = await CamerasModel.findByName(req.params.name);

    if (!camera) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera not exists',
      });
    }

    const controller = CameraController.cameras.get(req.params.name);

    if (!controller || (controller && !controller.prebuffer)) {
      return res.status(404).send({
        statusCode: 404,
        message: 'Camera controller not exists',
      });
    }

    controller.videoanalysis.stop(true);
    await setTimeoutAsync(1000);

    res.status(204).send({});
  } catch (error) {
    res.status(500).send({
      statusCode: 500,
      message: error.message,
    });
  }
};
