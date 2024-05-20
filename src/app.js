
const endpoint = 'https://sepolia.easscan.org/graphql';


const connectWallet = async () => {
    if (window.ethereum) {
        try {
            await window.ethereum.enable();
            console.log('Wallet connected');
        } catch (error) {
            console.error("User cancelled");
            return;
        }
    } else {
        // If no injected web3 instance is detected, display an error
        console.error('No wallet/metamask detected');
        return;
    }

    // Switch to Sepolia
    await window.ethereum.request({
        "method": "wallet_switchEthereumChain",
        "params": [
            {
            "chainId": "0xaa36a7"
            }
        ]
    });

    // Create a provider from the connected wallet
    let provider = new ethers.providers.Web3Provider(window.ethereum);

    // Get the signer from the provider
    let signer = provider.getSigner();

    // Define the contract ABI and address
    let contractABI = []; // Replace with your contract's ABI
    let contractAddress = ""; // Replace with your contract's address

    // Create a contract instance
    let contract = new ethers.Contract(contractAddress, contractABI, signer);

    // Call a contract method (replace "myMethod" and the arguments with your actual method and arguments)
    //let result = await contract.myMethod(arg1, arg2, ...);

    console.log(result);
};
window.connectWallet = connectWallet;

const getParentTopics = async (parentId) => {

    const query = `
        query Attestation($where: AttestationWhereUniqueInput!) {
            attestation(where: $where) {
                decodedDataJson
                refUID
                id
            }
        }
    `;

    const variables = {
        where: {
            id: parentId
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    });

    var topics = "";
    var topicName = "";
    var topicId = "";
    const data = await response.json();
    var parent = data.data.attestation.refUID;

    topicName = JSON.parse(data.data.attestation.decodedDataJson)[0].value.value
    topicId = data.data.attestation.id;

    if (parent != '0x0000000000000000000000000000000000000000000000000000000000000000') {
        topics += await getParentTopics(parent);
    } else {
        topicName = "Sepolia";
    }

    topics += "<a href='#' onclick='loadTopic(\"" + topicId + "\")'>" + topicName + "</a>/";

    return topics;
};
window.getParentTopics = getParentTopics;

const loadTopicList = async (topicId) => {
    const query = `
        query Attestations($where: AttestationWhereInput) {
            attestations(where: $where) {
                decodedDataJson
                id
            }
        }
    `;
    const variables = {
        where: {
                schemaId: {
                equals: "0xddc07ff085923cb9a3c58bf684344b7672881e5a004044e3e99527861fed6435"
            },
                refUID: {
                equals: topicId
            }
        }
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    });

    const data = await response.json();
    var topicInfo

    if (data.data.attestations.length == 0) {
        topicInfo =  "<p>No topics found</p>";
    } else {
        topicInfo = "<ul>";
        data.data.attestations.forEach(attestation => {
            topicInfo += "<li><a href='#' onclick='loadTopic(\"" + attestation.id + "\");'>" + JSON.parse(attestation.decodedDataJson)[0].value.value + "</a></li>";
        });
        topicInfo += "</ul>";
    }
    return topicInfo;
}
window.loadTopicList = loadTopicList;