import { EAS, Offchain, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from 'ethers';

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

const eas = new EAS(EASContractAddress);


const endpoint = 'https://sepolia.easscan.org/graphql';


const createNewTopic = async (topicName, currentTopic) => {
    topicName = topicName.toLowerCase();
    
    const schemaUID = "0xddc07ff085923cb9a3c58bf684344b7672881e5a004044e3e99527861fed6435";

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
    const schemaEncoder = new SchemaEncoder("string topic");
    const encodedData = schemaEncoder.encodeData([
        { name: "topic", value: topicName, type: "string" }
    ]);
    const tx = await eas.attest({
        schema: schemaUID,
        data: {
            recipient: "0x0000000000000000000000000000000000000000",
            expirationTime: 0,
            revocable: false, // Be aware that if your schema is not revocable, this MUST be false
            refUID: currentTopic,
            data: encodedData,
        },
    });
    const newAttestationUID = await tx.wait();
    console.log("New attestation UID:", newAttestationUID);
};
window.createNewTopic = createNewTopic;

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