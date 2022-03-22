import React, { useEffect, useState } from 'react';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';
import './styles/App.css';
import twitterLogo from './assets/twitter-logo.svg';
import { ethers } from 'ethers';

import contractAbi from "./utils/contractABI.json";

import polygonLogo from './assets/polygonlogo.png';
import ethLogo from './assets/ethlogo.png';
import fuseLogo from './assets/fuseLogo.svg';
import { networks } from './utils/networks';

// Constants
const TWITTER_HANDLE = '_buildspace';
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

const tld = '.flambu';
const CONTRACT_ADDRESS = '0x98Fb6985e199F49AD0eCE880Bc67Dc95943F42b4';
// Mumbai const CONTRACT_ADDRESS = '0xc3E363b146a99f9C4DFED9006549a1AB4B10ca1a';

const App = () => {

	const admin = false;
	const [loading, setLoading] = useState(false);
	const [txLink, setTxLink] = useState('');
	const [nftLink, setNFTLink] = useState('');
	const [mints, setMints] = useState([]);
	const [editing, setEditing] = useState(false);
	const [minted, setMinted] = useState(false);
	const [network, setNetwork] = useState('');
	const [currentAccount, setCurrentAccount] = useState('');
	const [domain, setDomain] = useState('');
	const [record, setRecord] = useState('');

	const connectWallet = async () => {
		try {
			const { ethereum } = window;

			if (!ethereum) {
				alert("Get Metamask -> https://metamask.io/");
				return;
			}

			const accounts = await ethereum.request({ method: "eth_requestAccounts" });

			console.log("Connected", accounts[0]);

			window.location.reload();

		} catch (error) {
			console.log(error);
		}
	}
	
	const switchNetwork = async () => {
		if (window.ethereum) {
			try {
				// Try to switch to the Mumbai testnet
				await window.ethereum.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: '0x7a' }], // Check networks.js for hexadecimal network ids
				});
			} catch (error) {
				// This error code means that the chain we want has not been added to MetaMask
				// In this case we ask the user to add it to their MetaMask
				if (error.code === 4902) {
					try {
						await window.ethereum.request({
							method: 'wallet_addEthereumChain',
							params: [
								{	
									chainId: '0x7a',
									chainName: 'Fuse Network',
									rpcUrls: ['https://rpc.fuse.io/'],
									nativeCurrency: {
											name: "FUSE",
											symbol: "FUSE",
											decimals: 18
									},
									blockExplorerUrls: ["https://explorer.fuse.io/"]
								},
							],
						});
					} catch (error) {
						console.log(error);
					}
				}
				console.log(error);
			}
		} else {
			// If window.ethereum is not found then MetaMask is not installed
			alert('MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html');
		} 
	}

	const checkIfWalletIsConnected = async () => {
		const { ethereum } = window;

		if (!ethereum) {
			console.log("Make sure you have Metamask!");
			return;
		} else {
			console.log("We have the ethereum object", ethereum);
		}

		const accounts = await ethereum.request({ method: 'eth_accounts' });

		if (accounts.length !== 0) {
			const account = accounts[0];
			console.log('Found an authorized account:', account);
			setCurrentAccount(account);
		} else {
			console.log('No authorized account found');
		}

		const chainId = await ethereum.request({ method: 'eth_chainId' });
		console.log("Connected to network chainId:", chainId, networks[chainId]);
		setNetwork(networks[chainId]);

		ethereum.on('chainChanged', handleChainChanged);

		function handleChainChanged(_chainId) {
			window.location.reload();
		}
	}

	const fetchMints = async () => {
		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);
				
				const names = await contract.getAllNames();

				const mintRecords = await Promise.all(names.map(async (name) => {
					const mintRecord = await contract.records(name);
					const owner = await contract.domains(name);
					return {
						id: names.indexOf(name),
						name: name,
						record: mintRecord,
						owner: owner,
					};
				}));

				console.log("MINTS FETCHED ", mintRecords);
				setMints(mintRecords);
			}
		} catch(error) {
			console.log(error);
		}
	}
	
	const updateDomain = async () => {
		if (!record || !domain) { return }
		setLoading(true);
		console.log("Updating domain", domain, "with record", record);
		try {
			const {ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signer);

				let tx = await contract.setRecord(domain, record);
				await tx.wait();
				console.log("Record set https://explorer.fuse.io/tx/"+tx.hash);

				fetchMints();
				setRecord('');
				setDomain('');
			}
		} catch(error) {
			console.log(error);
		}
		setLoading(false);
	}

	const mintDomain = async () => {
		if (!domain) { return }

		if (domain.length <3) {
			alert('Domain must be at least 3 characters long');
		}

		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);
				
				let currentTokenId = await contract.getCurrentTokenId();

				let price = await contract.price(domain);
				price = ethers.utils.formatEther(price);
				console.log("Minting domain", domain, "with price", price);

				console.log("Going to pop wallet now to pay gas...")
				
				let tx = await contract.register(domain, {value: ethers.utils.parseEther(price)});
				const receipt = await tx.wait();

				if (receipt.status === 1) {
					console.log("Domain minted! https://explorer.fuse.io/tx/"+tx.hash);
					
					// Set the record for the domain
					tx = await contract.setRecord(domain, record);
					await tx.wait();
	
					console.log("Record set! https:/explorer.fuse.io/tx/"+tx.hash);
					
					setTimeout(() => {
						fetchMints();
					}, 5000);
					
					setRecord('');
					setDomain('');
					setMinted(true);
					setTxLink(`https://explorer.fuse.io/tx/${tx.hash}`);
					setNFTLink(`https://tofunft.com/nft/fuse/${CONTRACT_ADDRESS}/${currentTokenId}`);
				}
				else {
					alert("Transaction failed! Please try again");
				}
			}
		} catch(error) {
			console.log(error);
		}
	}

	const withdrawFunds = async () => {
		const { ethereum } = window;
		if (ethereum) {
			const provider = new ethers.providers.Web3Provider(ethereum);
			const signer = provider.getSigner();
			const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi.abi, signer);
			contract.withdraw();
		}
	}

	const renderWithdrawFunds = () => (
		<button onClick={withdrawFunds} className="cta-button connect-wallet-button">
			Withdraw Funds
		</button>
	)

	const renderNotConnectedContainer = () => (
		<div className="connect-wallet-container">
			<img src="https://media.giphy.com/media/3ohhwytHcusSCXXOUg/giphy.gif" alt="Ninja gif" />
			<button onClick={connectWallet} className="cta-button connect-wallet-button">
				Connect Wallet
			</button>
		</div>
	);

	const renderMints = () => {
		if (currentAccount && mints.length > 0) {
			return (
				<div className="mint-container">
					<p className="subtitle"> Recently minted domains</p>
					<div className="mint-list">
						{ mints.map((mint, index) => {
							return (
								<div className="mint-item" key={index}>
									<div className="mint-row">
										<a className="link" href={`https://tofunft.com/nft/fuse/${CONTRACT_ADDRESS}/${mint.id}`}>
											<p className="underlined">{' '}{mint.name}{tld}{' '}</p>
										</a>
										{ mint.owner.toLowerCase() === currentAccount.toLowerCase() ?
											<button className="edit-button" onClick={() => editRecord(mint.name)}>
												<img className="edit-icon" src="https://img.icons8.com/metro/26/000000/pencil.png" alt="Edit button" />
											</button>
											:
											null
										}
									</div>
									<p> {mint.record} </p>
								</div>
							)
						})}
					</div>
				</div>
			)
		}
	}

	const editRecord = (name) => {
		console.log("Editing record for", name);
		setEditing(true);
		setDomain(name);
	}


	const renderMintedPopup = () => {
		return (
			<Popup open={minted} modal closeOnDocumentClick>
				<div className="popup">
					<h2 className="popup-title">Domain Minted Successfully!🥳</h2>
					<p className="popup-text">
					Checkout the <a href={txLink} target="_blank">transaction</a>
					<br></br>
					Checkout your <a href={nftLink} target="_blank">NFT</a>
					</p>
				</div>
			</Popup>
		)
	}

	const renderInputForm = () => {
		// If not on Polygon Mumbai Testnet, render "Please connect to Polygon Mumbai Testnet"
		if (network !== 'Fuse Network') {
			return (
				<div className="connect-wallet-container">
					<h2>Please switch to Fuse Network</h2>
					{/* This button will call our switch network function */}
					<button className='cta-button mint-button' onClick={switchNetwork}>Click here to switch</button>
				</div>
			);
		}

		return (
			<div className="form-container">
				<div className="first-row">
					<input
						type="text"
						value={domain}
						placeholder='domain'
						onChange={e => setDomain(e.target.value)}
					/>
					<p className='tld'> {tld} </p>
				</div>

				<input
					type="text"
					value={record}
					placeholder="whats your address?"
					onChange={e => setRecord(e.target.value)}
				/>

				{editing ? (
					<div className="button-container">
						<button className='cta-button mint-button' disabled={loading} onClick={updateDomain}>
							Set record
						</button>  
						<button className='cta-button mint-button' onClick={() => {setEditing(false)}}>
							Cancel
						</button>  
					</div>
				) : (
					<div className="button-container">
						<button className='cta-button mint-button' onClick={mintDomain}>
							Mint
						</button>
					</div>
				)}
			</div>
		)
	}

	useEffect(() => {
		checkIfWalletIsConnected();
		if (network === 'Fuse Network') {
			fetchMints();
		}
	}, [currentAccount, network]);

  	return (
		<div className="App">
			<div className="container">
				<div className="header-container">
					<header>
						<div className="left">
							<p className="title">🚀🔥 Flambu Name Service</p>
							<p className="subtitle">Register your Flambu domains!</p>
						</div>
						<div className="right">
							<img alt="Network logo" className="logo" src={ network.includes("Polygon") ? polygonLogo : network.includes("Fuse") ? fuseLogo : ethLogo} />
							{ currentAccount ? <p> Wallet: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)} </p> : <p> Not connected </p> }
						</div>
					</header>
				</div>

				{admin && renderWithdrawFunds()}
				{minted && renderMintedPopup()}
				{!currentAccount && renderNotConnectedContainer()}
				{currentAccount && renderInputForm()}
				{mints && renderMints()}

        		<div className="footer-container">
					<img alt="Twitter Logo" className="twitter-logo" src={twitterLogo} />
					<a
						className="footer-text"
						href={TWITTER_LINK}
						target="_blank"
						rel="noreferrer"
					>{`built with @${TWITTER_HANDLE}`}</a>
				</div>
			</div>
		</div>
	);
}

export default App;
