import { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.lokua.vmc',
  asar: true,
  asarUnpack: ['node_modules/naudiodon2/build/Release/*'],
  productName: 'VMC',
  directories: {
    output: 'release/${version}',
  },
  files: ['dist', 'dist-electron'],
  icon: 'public/icons/vmc',
  mac: {
    target: ['dmg'],
    artifactName: '${productName}-Mac-${version}-Installer.${ext}',
    extendInfo: {
      NSMicrophoneUsageDescription:
        'VMC uses audio input to display signals in Scope.',
    },
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    artifactName: '${productName}-Windows-${version}-Setup.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
  },
  linux: {
    target: ['AppImage'],
    artifactName: '${productName}-Linux-${version}.${ext}',
  },
}

export default config
