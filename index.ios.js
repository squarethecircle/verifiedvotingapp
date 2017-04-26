/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import moment from 'moment';

import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Button,
} from 'react-native';
import Camera from 'react-native-camera';

var width = Dimensions.get('window').width; //full width
var height = Dimensions.get('window').height; //full height
var EC = require('elliptic').ec;
var ec = new EC('p224');

export default class verifier extends Component {
  state = {
    bar: () => null,
    c_view: null,
    jdata: null,
  };

  constructor(props) {
    super(props);
    this.setState = this.setState.bind(this);
  }
  
  renderConfirmView(timestr, data) {
    let challenges = [];
    rev_d = {'1': 'ALICE', '2': 'BETTY', '3': 'CHARLIE'};
    for (let candidate in data['CHAL']) {
      challenges.push(<View key={candidate}><Text style={{fontSize: 16}}>Candidate: {rev_d[candidate]}</Text><Text style={{fontSize: 16}}>Challenge: {data['CHAL'][candidate]}</Text></View>);
    }
    return (
      <View style={styles.c_view}>
        <Text style={{fontSize: 16}}>
          Receipt generated at or after {timestr}.{"\n"}
        </Text>
        <Text style={{fontSize: 16}}>
          Please verify that the following content matches your receipt exactly.{"\n"}
        </Text>
        <Text style={{fontSize: 16}}>
          Voter ID: {data['ID']}{"\n"}
        </Text>
        <Text style={{fontSize: 16}}>
        {"\n"}Commitment: {data['CMT']}{"\n"}
        </Text>
        {challenges}
        <Text style={{fontSize: 16}}>
          {"\n"}Timestamp: {data['B_T']}{"\n"}
          Beacon Value: {data['B_V']}{"\n"}
        </Text>
				<Button
					onPress={() => this.setState({c_view: null})}
          title='Confirm'
					color="#841584"
				/>
      </View>
   );
  }

  enterPlaintext = () => {
    this.setState({bar: this.readQR});
  }

  enterCiphertext = () => {
    this.setState({bar: this.verifySignature});
  }

  enterBulletinBoard = () => {
    this.setState({bar: this.verifyBulletinBoard});
  }
  
  render() {
    return (
      <View style={styles.container}>
        {this.state.c_view ? this.state.c_view :
          <Camera 
            ref={(cam) => {
              this.camera = cam;
            }}
            style={styles.preview}
            aspect={Camera.constants.Aspect.fill}
            captureTarget={Camera.constants.CaptureTarget.temp}
            barCodeTypes={['org.iso.QRCode']}
            onBarCodeRead={(e) => this.state.bar(e.data)}>
            <Text style={this.state.bar == this.verifyBulletinBoard ? styles.captureQR : styles.capture} onPress={this.enterBulletinBoard}>[Verify Bulletin Board]</Text>
            <Text style={this.state.bar == this.readQR ? styles.captureQR : styles.capture} onPress={this.enterPlaintext}>[Load Plaintext]</Text>
            <Text style={this.state.bar == this.verifySignature ? styles.captureQR : styles.capture} onPress={this.enterCiphertext}>[Verify Signature]</Text> 
            </Camera> 
        }
          </View>
    );
  }

  readQR = (data) => {
    this.setState({bar: () => null});
    let parsed = JSON.parse(data);
    if (parsed['B_T'] == undefined) {
      return;
    }
    this.setState({jdata: data});
    let outputRe = /<outputValue>(.*)<\/outputValue>/;
    fetch('https://beacon.nist.gov/rest/record/' + parsed['B_T'])
      .then((response) => response.text())
      .then((text) => {
        if (outputRe.exec(text)[1] == parsed['B_V']) {
          let timestr = moment.unix(parseInt(parsed['B_T'])).format('MMMM Do YYYY, h:mm:ss a');
          this.setState({c_view: this.renderConfirmView(timestr, parsed)});
          return;
        } else {
          console.warn("BEACON FAILED TO VALIDATE!!!");
        }
      });
  }

  toHex = (str) => {
    let s = unescape(encodeURIComponent(str));
    let h = '';
    for (let i = 0; i < s.length; i++) {
			h += s.charCodeAt(i).toString(16);
    }
    return h;
   }

  verifySignature = (data) => {
    this.setState({bar: () => null});
		let button =
			<Button
				onPress={() => this.setState({c_view: null})}
				title='Continue'
				color="#841584"
			/>;
		let verified = false;
		try {
			let ver_key = ec.keyFromPublic({x:'fa66b3519a80b365efbc6537dad67f89753390ec56d9f14c03167f57', y:'7ffa74a6a55b3029e7acfdf29423056d0e8d72afc4d553f1d04e54e6'});
			let sig = JSON.parse(data);
			verified = ver_key.verify(this.toHex(this.state.jdata), sig);
		} catch (e) {}
		let SUCCESS = <View style={styles.c_view}><Text style={{fontSize: 24, color: 'green'}}>SIGNATURE VERIFIED</Text>{button}</View>;
		let FAIL = <View style={styles.c_view}><Text style={{fontSize:24, color: 'red'}}>VOTE FAILED TO VERIFY -- SIGNATURE MISMATCH</Text>{button}</View>;
    this.setState({c_view: verified ? SUCCESS : FAIL});
  }

  verifyBulletinBoard = (data) => {
    this.setState({bar: () => null});
		let button =
			<Button
				onPress={() => this.setState({c_view: null})}
				title='Continue'
				color="#841584"
			/>;
		let SUCCESS = <View style={styles.c_view}><Text style={{fontSize: 24, color: 'green'}}>VERIFIED -- RECEIPT FOUND ON BULLETIN BOARD</Text>{button}</View>;
		let FAIL = <View style={styles.c_view}><Text style={{fontSize:24, color: 'red'}}>FAILED TO VERIFY -- RECEIPT NOT FOUND ON BULLETIN BOARD</Text>{button}</View>;
		try {
				fetch('https://9ecf4c0a.ngrok.io/verify', {  
					method: 'POST',  
					headers: {
						'Accept': 'application/json',
						'Content-Type': 'application/json'
					}, 
					body: data
				})
				.then((response) => response.json())
				.then((d) => {
					if (d['verified']) {
						this.setState({c_view: SUCCESS});
					} else {
						this.setState({c_view: FAIL});
					}
				})  
		} catch (e) {
			this.setState({c_view: FAIL});
		}
  }
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  c_view: {
    flex: 1,
    flexDirection: 'column',
    margin: 40,
    backgroundColor: '#EEE',
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  captureQR: {
    flex: 0,
    backgroundColor: '#32CD32',
    borderRadius: 5,
    color: '#000',
    padding: 10,
    marginBottom: 30
  },
  capture: {
    flex: 0,
    backgroundColor: '#fff',
    borderRadius: 5,
    color: '#000',
    padding: 10,
    marginBottom: 30
  }
});

AppRegistry.registerComponent('verifier', () => verifier);

