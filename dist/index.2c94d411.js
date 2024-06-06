let pageState = {
    "chain": "",
    "topic": "",
    "editor": "",
    "filters": []
};
let basePath = "";
let schemas = {
    "0xddc07ff085923cb9a3c58bf684344b7672881e5a004044e3e99527861fed6435": {
        "name": "topic",
        "display": "Subtopics",
        "properties": [
            {
                "name": "topic",
                "display": "Topic",
                "type": "string",
                "formType": "text"
            }
        ]
    },
    "0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01": {
        "name": "property",
        "display": "Properties",
        "properties": [
            {
                "name": "name",
                "display": "Name",
                "type": "string",
                "formType": "text"
            },
            {
                "name": "value",
                "display": "Value",
                "type": "string",
                "formType": "text"
            },
            {
                "name": "mediaType",
                "display": "Media Type",
                "type": "string",
                "formType": "text"
            },
            {
                "name": "Offchain",
                "display": "Is Offchain? (IPFS)",
                "type": "bool",
                "formType": "checkbox"
            }
        ]
    },
    "0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f": {
        "name": "message",
        "display": "Messages",
        "properties": [
            {
                "name": "message",
                "display": "Message",
                "type": "string",
                "formType": "text"
            }
        ]
    }
};
const gotoTopic = async (topicId, editor)=>{
    console.log(`gotoTopic `, topicId, editor);
    if (topicId) pageState.topic = topicId;
    if (editor) pageState.editor = editor;
    let path = basePath + await getTopicPath(topicId);
    // let topicName = await topicIdToName(topicId);
    // if (topicName == "root") { topicName = ""; }
    // let path = window.location.href + (window.location.href.endsWith("/") ? "" : "/") + topicName;
    history.pushState(pageState, "", path);
    //(topicSegments.length > 0 ? "/" + topicSegments.join('/') : "");
    loadTopic(topicId);
};
const loadTopic = async (topicId)=>{
    console.log(`loadTopic `, topicId);
    document.getElementById("topicPath").innerHTML = "Loading...";
    document.getElementById("app").innerHTML = "";
    Object.keys(schemas).forEach((schemaId)=>{
        let schemaView = document.createElement("div");
        schemaView.id = "View" + schemaId;
        schemaView.classList.add("schemaView");
        let h2 = document.createElement("h2");
        h2.textContent = schemas[schemaId].display + " ";
        let span = document.createElement("span");
        span.classList.add("createAttestation");
        let a = document.createElement("a");
        a.href = "";
        a.onclick = (event)=>{
            event.preventDefault();
            openAttestationEditor(schemaId);
        };
        a.textContent = "[Create New]";
        span.appendChild(a);
        h2.appendChild(span);
        schemaView.appendChild(h2);
        let list = document.createElement("div");
        list.id = "List" + schemaId;
        schemaView.appendChild(list);
        document.getElementById("app").appendChild(schemaView);
    });
    document.getElementById("topicPath").innerHTML = await getParentTopics(topicId);
    document.getElementById("List0xddc07ff085923cb9a3c58bf684344b7672881e5a004044e3e99527861fed6435").innerHTML = await loadTopicList(topicId, pageState.editor);
    console.log(`loadTopic `, topicId, pageState.editor);
    let properties = await loadProperties(topicId, pageState.editor);
    if (properties.length === 0) document.getElementById("List0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01").innerHTML = "No properties found.";
    else {
        let table = document.createElement("table");
        properties.forEach((property)=>{
            let row = document.createElement("tr");
            let cell1 = document.createElement("td");
            cell1.textContent = property.decodedDataJson[0].value.value;
            cell1.classList.add("propName");
            cell1.id = property.id;
            row.appendChild(cell1);
            let cell2 = document.createElement("td");
            cell2.textContent = property.decodedDataJson[1].value.value;
            cell2.classList.add("propValue");
            row.appendChild(cell2);
            table.appendChild(row);
        });
        document.getElementById("List0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01").appendChild(table);
    }
    let messages = await getMessagesForTopic(topicId, 3, pageState.editor);
    if (messages == "<ul></ul>") document.getElementById("List0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f").innerHTML = "No messages found.";
    else document.getElementById("List0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f").innerHTML = messages;
    // Use ENS for addresses
    setTimeout(()=>{
        document.querySelectorAll("span.ethAddress").forEach((span)=>{
            ensLookup(span.textContent).then((ensName)=>{
                span.innerHTML = `<span title="${span.textContent}">${ensName ? ensName : span.textContent}</span>`;
            });
        });
    }, 10);
    pageState.topic = topicId;
};
const setEditor = async ()=>{
    let editor = document.getElementById("editorInput").value;
    console.log(`setEditor `, editor);
    pageState.editor = editor;
    gotoTopic(pageState.topic, editor);
};
const search = async ()=>{
    var topic = document.getElementById("search").value;
    loadTopic(topic);
};
const toggleFilter = async (filter)=>{
    let filterValue = document.getElementById(filter).checked;
    console.log(`toggleFilter `, filter, filterValue);
    // change pageState.filters, if filter is not in the array, add it, if it is, remove it
    if (filterValue) {
        if (!pageState.filters.includes(filter)) pageState.filters.push(filter);
    } else {
        const index = pageState.filters.indexOf(filter);
        if (index !== -1) pageState.filters.splice(index, 1);
    }
    loadTopic(pageState.topic);
//pageState.filters.includes(filter) ? pageState.filters.splice(pageState.filters.indexOf(filter), 1) : pageState.filters.push(filter);
};
const openAttestationEditor = async (schemaId)=>{
    var attestationEditor = document.getElementById("New" + schemaId);
    if (attestationEditor == null) {
        attestationEditor = document.createElement("div");
        attestationEditor.id = "New" + schemaId;
        document.getElementById("List" + schemaId).prepend(attestationEditor);
        attestationEditor.innerHTML = "<h3>New " + schemas[schemaId].name + "</h3>";
        schemas[schemaId].properties.forEach((property)=>{
            attestationEditor.innerHTML += property.display + ": <input id='" + property.name + "' type='" + property.formType + "'><br />";
        });
        attestationEditor.innerHTML += "<button onclick='callCreateAttestation(\"" + schemaId + "\")'>Create</button></div>";
        attestationEditor.toggleAttribute("hidden");
    }
    attestationEditor.toggleAttribute("hidden");
};
const callCreateAttestation = async (schemaId)=>{
    let data = {};
    let inputs = document.querySelectorAll(`#New${schemaId} input`);
    inputs.forEach((input)=>{
        if (input.type === "checkbox") {
            data[input.id] = input.checked;
            input.checked = false;
        } else {
            data[input.id] = input.value;
            input.value = "";
        }
    });
    createAttestation(schemaId, data, pageState.topic);
    document.getElementById("New" + schemaId).toggleAttribute("hidden");
};
let chains = {
    "0xaa36a7": {
        "name": "Sepolia",
        "altId": "11155111",
        "Id": "0xaa36a7",
        "graphEndpoint": "https://sepolia.easscan.org/graphql",
        "rpcEndpoint": "",
        "rootTopic": "0x6e4851b1ee4ee826a06a4514895640816b4143bf2408c33e5c1263275daf53ce"
    }
};
let chainsName = {
    "sepolia": "0xaa36a7"
};
let chainsAltId = {
    "11155111": "0xaa36a7"
};
function getChainIdFromName(name) {
    return chainsName[name.toLowerCase()];
}
function getChainNameFromId(id) {
    return chains[id].name;
}
function getChain(id) {
    return chains[id];
}
function getChainIdFromUserInput(input) {
    input = input.toLowerCase().trim();
    return chainsName[input] || chains[input]?.Id || chainsAltId[input];
}
//document.addEventListener("DOMContentLoaded", (event) => {
window.addEventListener("load", (event)=>{
    let topicId = "";
    let topicSegments = location.hash.split("/").filter((segment)=>segment !== "" && !segment.startsWith("#"));
    let chainInput = (location.hash.split("/").filter((segment)=>segment.startsWith("#"))[0] ?? "").substring(1);
    pageState.chain = getChainIdFromUserInput(chainInput);
    let chainHash = "";
    if (pageState.chain === undefined) {
        console.error(`Unknown chain: "${chainInput}"`);
        // default to Sepolia
        pageState.chain = "0xaa36a7";
        chainHash = "#sepolia";
    } else chainHash = "#" + getChainNameFromId(pageState.chain).toLowerCase();
    let url = new URL(location.href);
    url.hash = "";
    basePath = url.toString();
    let cleanUrl = url + chainHash + "/" + topicSegments.join("/");
    // popuplate pageState.filters with checkbox values from id=filters
    let filters = document.getElementById("filters");
    if (filters) filters.querySelectorAll("input").forEach((filter)=>{
        if (filter.checked) {
            pageState.filters.push(filter.id);
            console.log(`Adding filter `, filter.id);
        }
    });
    // console.log(`rawSegments `, location.hash.split('/'));
    // console.log(`topicSegments `, topicSegments);
    // console.log(`chainInput `, chainInput);
    // console.log(`pageState.chain `, pageState.chain);
    // console.log(`chainHash `, chainHash);
    // console.log(`rawUrl `, url);
    // console.log(`cleanUrl `, cleanUrl);
    (async function() {
        if (topicSegments.length === 0) pageState.topic = chains[pageState.chain].rootTopic;
        else pageState.topic = await topicPathToId(topicSegments);
        history.replaceState(pageState, "", cleanUrl);
        loadTopic(pageState.topic);
    //console.log(`Loading topic ${pageState.topic}`);
    })();
});
window.addEventListener("popstate", (event)=>{
    console.log(`popstate `, event);
    if (event.state) {
        console.log(`popstate event.state`, event.state);
        let topic = event.state.topic;
        //console.log(`Loading topic ${topic}`);
        loadTopic(topic);
    }
});

//# sourceMappingURL=index.2c94d411.js.map
