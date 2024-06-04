import { EAS, Offchain, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from 'ethers';

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26


const endpoint = 'https://sepolia.easscan.org/graphql';

let signer;
let provider;
let eas;

const setupEAS = async () => {

    if (eas !== undefined) { return eas; }

    if (window.ethereum == null) {

        // If MetaMask is not installed, we use the default provider,
        // which is backed by a variety of third-party services (such
        // as INFURA). They do not have private keys installed,
        // so they only have read-only access
        console.log("MetaMask not installed; using read-only defaults")
        provider = ethers.getDefaultProvider("sepolia")

    } else {

        // Connect to the MetaMask EIP-1193 object. This is a standard
        // protocol that allows Ethers access to make all read-only
        // requests through MetaMask.
        provider = new ethers.BrowserProvider(window.ethereum, "sepolia")
    }


    await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }],    // chainId must be in HEX with 0x in front
    });

    signer = await provider.getSigner();

    eas = new EAS(EASContractAddress);
    eas.connect(signer);

}

const ensProvider = ethers.getDefaultProvider();
const ensCache = {};
const inFlightLookups = {};

async function ensLookup(address) {
    let ensName = "";

    try {
        //console.log(`Looking up ENS name for address ${address}`);
        if (ensCache[address]) {
            //console.log(`The cached ENS name for address ${address} is ${ensCache[address]}`);
            return ensCache[address];
        }
        if (inFlightLookups[address]) {
            //console.log(`Waiting for in-flight ENS name lookup for address ${address}`);
            ensName = await inFlightLookups[address];
        } else {
            //console.log(`No cached ENS name found for address ${address}`);
            inFlightLookups[address] = ensProvider.lookupAddress(address);
            ensName = await inFlightLookups[address];
            delete inFlightLookups[address];
            if (ensName) {
                ensCache[address] = ensName;
                console.log(`The ENS name for address ${address} is ${ensName}`);
            } else {
                console.log(`No ENS name found for address ${address}`);
            }
        }
    } catch (error) {
        console.error(`Failed to lookup ENS name: ${error}`);
    }
    return ensName;
}
window.ensLookup = ensLookup;

const createAttestation = async (schemaUID, data, refUID) => {

    await setupEAS();

    let schemaEncoder;
    let encodedData;
    let recipient = "0x0000000000000000000000000000000000000000";
    let expirationTime = 0;
    let revocable = false;
    let tx;

    switch (schemaUID) {
        case "0xddc07ff085923cb9a3c58bf684344b7672881e5a004044e3e99527861fed6435":
            let topicName = data.topic.toLowerCase();
            schemaEncoder = new SchemaEncoder("string topic");
            encodedData = schemaEncoder.encodeData([
                { name: "topic", value: topicName, type: "string" }
            ]);
            break;
        case "0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01":
            schemaEncoder = new SchemaEncoder("string name,string value,string mediaType,bool offchain");
            encodedData = schemaEncoder.encodeData([
                { name: "name", value: data.name, type: "string" },
                { name: "value", value: data.value, type: "string" },
                { name: "mediaType", value: data.mediaType, type: "string" },
                { name: "offchain", value: data.offchain, type: "bool" }
            ]);
            revocable = true;
            break;
        case "0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f":
            schemaEncoder = new SchemaEncoder("string message");
            encodedData = schemaEncoder.encodeData([
                { name: "message", value: data.message, type: "string" }
            ]);
            revocable = true;
            break;
        default: return;
    }

    tx = await eas.attest({
        schema: schemaUID,
        data: {
            recipient: recipient,
            expirationTime: expirationTime,
            revocable: revocable, // Be aware that if your schema is not revocable, this MUST be false
            refUID: refUID,
            data: encodedData,
        },
    });
    const newAttestationUID = await tx.wait();
    console.log("New attestation UID:", newAttestationUID);
}
window.createAttestation = createAttestation;

const loadProperties = async (topicId, editor) => {
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
                "equals": "0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01"
            },
            refUID: {
                "equals": topicId
            },
        }
    };
    if (editor) {
        variables.where.attester = { "equals": editor };
        console.log("Filtering by editor", editor);
    } else {
        console.log("Not filtering by editor");
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    });
    const data = await response.json();
    const attestations = data.data.attestations;
    attestations.forEach(attestation => {
        attestation.decodedDataJson = JSON.parse(attestation.decodedDataJson);
    });
    return attestations;
}
window.loadProperties = loadProperties;

const getNumMessages = async (topicId) => {
    const query = `
        query {
            aggregateAttestation(
            where: {
                schemaId: { equals: "0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f" },
                refUID: { equals: "` + topicId + `"}
            }
            ) {
            _count {
                _all
            }
            }
        }
    `;
    const variables = {
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
    return data.data.aggregateAttestation._count._all;
}
window.getNumMessages = getNumMessages;

const getMessagesForTopic = async (topicId, depth, editor) => {

    if (depth == 0) { return ""; }
    if (depth == null) { depth = 2; }

    const query = `
        query Attestations($where: AttestationWhereInput, $orderBy: [AttestationOrderByWithRelationInput!]) {
            attestations(where: $where, orderBy: $orderBy) {
                id
                decodedDataJson
                attester
                time
                revoked
            }
        }
    `;
    const variables = {
        where: {
            schemaId: {
                equals: "0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f"
            },
            refUID: {
                equals: topicId
            },
        },
        orderBy: {
            time: "desc"
        },
    };
    if (editor) {
        variables.where.attester = { "equals": editor };
        console.log("getMessagesForTopic filtering by editor", editor);
    }
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    });

    const data = await response.json();
    var messages = "<ul>";
    for (let i = 0; i < data.data.attestations.length; i++) {
        let attestation = data.data.attestations[i];
        let time = new Date(attestation.time * 1000);
        let msgInfo = "<span class='ethAddress'>" + attestation.attester + "</span> at " + time.toLocaleString();
        let messageBody = JSON.parse(attestation.decodedDataJson)[0].value.value;
        let actReply = "[<a href='#' onclick='document.getElementById(\"replyBox" + attestation.id + "\").style.display = \"inline\"'>Reply</a>] <span class='replyBox' id='replyBox" + attestation.id + "'><input id=\"replyInput" + attestation.id + "\" type=\"text\"> <button onclick=\"replyToMessage('" + attestation.id + "', document.getElementById('replyInput" + attestation.id + "').value); document.getElementById('replyBox" + attestation.id + "').style.display = 'none';\">Reply</button></span>";
        let actReact = "[React]";
        messages += "<li class='message' id='" + attestation.id + "'><span class='messageInfo'>" + msgInfo + "</span></span><span class='messageBody'>" + messageBody + "</span><span class='messageActions'> " + actReply + " " + actReact + "<span></li>";
        messages += await getMessagesForTopic(attestation.id, depth - 1);
    }
    messages += "</ul>";
    return messages;
}
window.getMessagesForTopic = getMessagesForTopic;

async function performEnsLookup() {

    if (window.ethereum == null) {

        // If MetaMask is not installed, we use the default provider,
        // which is backed by a variety of third-party services (such
        // as INFURA). They do not have private keys installed,
        // so they only have read-only access
        console.log("MetaMask not installed; using read-only defaults")
        provider = ethers.getDefaultProvider("mainnet")

    } else {

        // Connect to the MetaMask EIP-1193 object. This is a standard
        // protocol that allows Ethers access to make all read-only
        // requests through MetaMask.
        provider = new ethers.BrowserProvider(window.ethereum, "mainnet")

        // It also provides an opportunity to request access to write
        // operations, which will be performed by the private key
        // that MetaMask manages for the user.
        signer = await provider.getSigner();
    }

    // Get all spans with class="address"
    let spans = document.querySelectorAll('span.address');

    // Create an array to hold the promises
    let promises = [];

    // Loop through each span
    for (let i = 0; i < spans.length; i++) {
        // Get the address from the span's text content
        let address = spans[i].textContent;
        console.log("Address: ", address);

        // Perform an ENS lookup on the address
        let promise = provider.lookupAddress(address)
            .then(ensName => {
                console.log("ENS Name: ", ensName);
                // If an ENS name was found, update the span's text content
                if (ensName) {
                    spans[i].textContent = ensName;
                }
            })
            .catch(error => {
                console.error("Error performing ENS lookup: ", error);
            });

        // Add the promise to the array
        promises.push(promise);
    }

    // Wait for all promises to resolve
    await Promise.all(promises);
}
window.performEnsLookup = performEnsLookup;

window.replyToMessage = async (msgId, message) => {

    console.log("Replying to message", msgId, "with message", message);

    const schemaUID = "0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f";

    let signer;
    let provider;
    if (window.ethereum == null) {

        // If MetaMask is not installed, we use the default provider,
        // which is backed by a variety of third-party services (such
        // as INFURA). They do not have private keys installed,
        // so they only have read-only access
        console.log("MetaMask not installed; using read-only defaults")
        provider = ethers.getDefaultProvider("sepolia")

    } else {

        // Connect to the MetaMask EIP-1193 object. This is a standard
        // protocol that allows Ethers access to make all read-only
        // requests through MetaMask.
        provider = new ethers.BrowserProvider(window.ethereum, "sepolia")

        // It also provides an opportunity to request access to write
        // operations, which will be performed by the private key
        // that MetaMask manages for the user.
        signer = await provider.getSigner();
    }

    // TODO: Make sure we're on Sepolia

    // Signer must be an ethers-like signer.
    eas.connect(signer);
    // Initialize SchemaEncoder with the schema string
    const schemaEncoder = new SchemaEncoder("string message");
    const encodedData = schemaEncoder.encodeData([
        { name: "message", value: message, type: "string" }
    ]);
    const tx = await eas.attest({
        schema: schemaUID,
        data: {
            recipient: "0x0000000000000000000000000000000000000000",
            expirationTime: 0,
            refUID: msgId,
            revocable: true, // Be aware that if your schema is not revocable, this MUST be false
            data: encodedData,
        },
    });
    const newAttestationUID = await tx.wait();
    console.log("New attestation UID:", newAttestationUID);
}

const getParentTopics = async (parentId) => {

    console.log("getParentTopics ", parentId);

    if (parentId == chains[pageState.chain].root) {
        return "";
    }

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

let topicCache = {};
const topicIdToName = async (topicId) => {
    let topicName = topicCache[topicId];
    if (topicName == null) {
        console.log(`topicIdToName miss for ${topicId}`);
        const query = `
            query Attestation($where: AttestationWhereUniqueInput!) {
                attestation(where: $where) {
                    decodedDataJson
                    refUID
                }
            }
        `;
        const variables = {
            where: {
                id: topicId
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
        topicName = JSON.parse(data.data.attestation.decodedDataJson)[0].value.value;
        let parentId = data.data.attestation.refUID;
        topicCache[topicId] = topicName;
        topicCache[parentId + "/" + topicName] = topicId;
    }
    return topicName;
}
window.topicIdToName = topicIdToName;

const topicNameToId = async (topicName, parentId) => {
    let topicId = "";
    topicName = topicName.toLowerCase();
    
    if (parentId == null) {
        parentId = "0x6e4851b1ee4ee826a06a4514895640816b4143bf2408c33e5c1263275daf53ce";
    }

    if (topicCache[parentId + "/" + topicName] != null) {
        return topicCache[parentId + "/" + topicName];
    } else {
        console.log(`topicNameToId cache miss for ${parentId}/${topicName}`);
    }

    const query = `
        query FindFirstAttestation($where: AttestationWhereInput) {
            findFirstAttestation(where: $where) {
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
                equals: parentId
            },
            decodedDataJson: {
                contains: topicName
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

    topicId = data.data.findFirstAttestation.id;

    //console.log(`Topic name ${parentId}/${topicName} is ${topicId}`);

    topicCache[topicId] = topicName;
    topicCache[parentId + "/" + topicName] = topicId;

    return topicId;
}
window.topicNameToId = topicNameToId;

const topicPathToId = async (topics) => {
    
    let topicId;
    let parentId;

    if (parentId == null) {
        parentId = "0x6e4851b1ee4ee826a06a4514895640816b4143bf2408c33e5c1263275daf53ce";
    }

    for (let i = 0; i < topics.length; i++) {
        topicId = await topicNameToId(topics[i], parentId);
        parentId = topicId;
    }
    
    //console.log(`Topic path ${topics} is ${topicId}`);
    return topicId;
}
window.topicPathToId = topicPathToId;

const loadTopicList = async (topicId, editor) => {

    console.log(`loadTopicList `, topicId, editor);

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
    if (editor) {
        variables.where.attester = { "equals": editor };
        console.log("loadTopicList filtering by editor", editor);
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: query,
            variables: variables
        })
    });

    const data = await response.json();
    var topicInfo;
    var topicName;
    var topicId;
    var newUrl;
    var topicObj;

    if (data.data.attestations.length == 0) {
        topicInfo = "<p>No topics found</p>";
    } else {
        topicInfo = "<ul>";
        data.data.attestations.forEach(attestation => {
            topicName = JSON.parse(attestation.decodedDataJson)[0].value.value;
            topicId = attestation.id;
            topicObj = { "topicId": topicId };
            newUrl = window.location.href + (window.location.href.endsWith("/") ? "" : "/") + topicName;
            topicInfo += "<li><a href='" + newUrl + "' onclick='event.preventDefault(); gotoTopic(\"" + topicId + "\");'>" + topicName + "</a></li>";
        });
        topicInfo += "</ul>";
    }
    return topicInfo;
}
window.loadTopicList = loadTopicList;